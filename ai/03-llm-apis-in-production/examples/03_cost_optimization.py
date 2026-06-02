"""
Chapter 3, Example 3: Cost Optimization Patterns

What this demonstrates:
- Counting tokens before sending (prevent surprises)
- Model selection by task type (the highest-leverage cost lever)
- Response caching with Redis (avoid repeat API calls)
- The complete ProductionLLMClient pattern
- Batch processing with concurrency control

Run with:
    pip install openai tiktoken redis tenacity
    export OPENAI_API_KEY=sk-...
    # Optional: redis-server (caching demo will skip if unavailable)
    python 03_cost_optimization.py
"""

import asyncio
import hashlib
import json
import logging
import os
from typing import Optional

import openai
import tiktoken
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ─── Part 1: Token counting — know your cost before you send ─────────────────

class TokenCostEstimator:
    # Prices per 1M tokens (check provider pricing — these change)
    PRICING = {
        "gpt-4o":            {"input": 2.50,  "output": 10.00},
        "gpt-4o-mini":       {"input": 0.15,  "output": 0.60},
        "gpt-4.5":           {"input": 75.00, "output": 150.00},  # top-tier
        "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
        "claude-3-haiku-20240307":    {"input": 0.25, "output": 1.25},
    }

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        # tiktoken knows the encoding for most OpenAI models
        try:
            self.enc = tiktoken.encoding_for_model(model)
        except KeyError:
            # Fallback for models not in tiktoken (e.g., Claude)
            self.enc = tiktoken.get_encoding("cl100k_base")

    def count(self, text: str) -> int:
        return len(self.enc.encode(text))

    def count_messages(self, messages: list[dict]) -> int:
        """Count tokens in a messages array (includes role tokens)."""
        total = 0
        for msg in messages:
            # Each message has ~4 overhead tokens for role/formatting
            total += 4 + self.count(msg.get("content", ""))
        total += 2  # reply priming tokens
        return total

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Returns cost in USD."""
        pricing = self.PRICING.get(self.model, {"input": 1.0, "output": 4.0})
        return (
            input_tokens * pricing["input"] +
            output_tokens * pricing["output"]
        ) / 1_000_000

    def daily_cost_projection(
        self,
        requests_per_day: int,
        avg_input_tokens: int,
        avg_output_tokens: int,
    ) -> dict:
        per_request = self.estimate_cost(avg_input_tokens, avg_output_tokens)
        return {
            "per_request_usd": per_request,
            "daily_usd": per_request * requests_per_day,
            "monthly_usd": per_request * requests_per_day * 30,
        }


def demonstrate_token_costs():
    """Show cost difference between models for the same task."""
    task = "Classify the sentiment of this product review: 'The battery life is excellent but the screen is too dim for outdoor use.'"

    print("\n=== Token Cost Comparison (same task, different models) ===")

    models_to_compare = [
        ("gpt-4o",      5),    # expected: ~5 output tokens ("MIXED" or similar)
        ("gpt-4o-mini", 5),
    ]

    for model_name, expected_output_tokens in models_to_compare:
        estimator = TokenCostEstimator(model_name)
        input_tokens = estimator.count(task)
        cost = estimator.estimate_cost(input_tokens, expected_output_tokens)
        daily = estimator.daily_cost_projection(10_000, input_tokens, expected_output_tokens)

        print(f"\nModel: {model_name}")
        print(f"  Input tokens:  {input_tokens}")
        print(f"  Cost per call: ${cost:.6f}")
        print(f"  @ 10K calls/day: ${daily['daily_usd']:.2f}/day = ${daily['monthly_usd']:.2f}/month")

    print("\nConclusion: For simple classification, gpt-4o-mini is 17x cheaper.")
    print("Verify quality against your actual data before switching.")


# ─── Part 2: Response caching ─────────────────────────────────────────────────

class SimpleCachingLLMClient:
    """
    LLM client with in-memory cache (for demo — use Redis in production).
    
    Only cache deterministic calls (temperature=0).
    Cache key = SHA256 of (model + messages + relevant params).
    """

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.client = openai.OpenAI(api_key=api_key)
        self.model = model
        self._cache: dict[str, str] = {}  # Replace with Redis in production
        self._cache_hits = 0
        self._cache_misses = 0

    def _cache_key(self, messages: list, model: str, max_tokens: int) -> str:
        payload = json.dumps(
            {"model": model, "messages": messages, "max_tokens": max_tokens},
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    @retry(
        retry=retry_if_exception_type((openai.RateLimitError, openai.InternalServerError)),
        wait=wait_exponential_jitter(initial=1, max=30, jitter=3),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def complete(
        self,
        messages: list,
        temperature: float = 0,
        max_tokens: int = 100,
        use_cache: bool = True,
    ) -> str:
        # Caching only safe for deterministic calls
        if use_cache and temperature == 0:
            key = self._cache_key(messages, self.model, max_tokens)
            if key in self._cache:
                self._cache_hits += 1
                logger.info(f"Cache HIT (hit_rate={self._cache_hits/(self._cache_hits+self._cache_misses):.1%})")
                return self._cache[key]

        self._cache_misses += 1
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        result = response.choices[0].message.content

        if use_cache and temperature == 0:
            self._cache[key] = result

        return result

    def cache_stats(self):
        total = self._cache_hits + self._cache_misses
        return {
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": self._cache_hits / total if total > 0 else 0,
        }


# ─── Part 3: Async batch with concurrency limit ───────────────────────────────

async def process_batch_with_limits(
    texts: list[str],
    api_key: str,
    model: str = "gpt-4o-mini",
    concurrency: int = 5,
) -> list[str]:
    """
    Process a batch of texts concurrently, respecting rate limits.
    
    asyncio.Semaphore(concurrency) ensures at most `concurrency`
    simultaneous API calls. Without this, 1000 tasks would fire 1000
    simultaneous requests → instant 429.
    """
    async_client = openai.AsyncOpenAI(api_key=api_key)
    semaphore = asyncio.Semaphore(concurrency)

    async def classify_one(text: str) -> str:
        async with semaphore:  # Blocks if concurrency limit reached
            response = await async_client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Reply with only: POSITIVE, NEGATIVE, or NEUTRAL",
                    },
                    {"role": "user", "content": text},
                ],
                max_tokens=5,
                temperature=0,
            )
            return response.choices[0].message.content.strip()

    # Fire all tasks — semaphore internally queues excess requests
    tasks = [classify_one(text) for text in texts]
    return await asyncio.gather(*tasks)


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY not set")
        exit(1)

    # 1. Cost comparison
    demonstrate_token_costs()

    # 2. Caching demo
    print("\n\n=== Response Caching Demo ===")
    cache_client = SimpleCachingLLMClient(api_key)
    test_messages = [
        {"role": "system", "content": "You are a classifier. Reply: POSITIVE, NEGATIVE, or NEUTRAL"},
        {"role": "user", "content": "Great product, works perfectly!"},
    ]

    # First call: cache miss → API call
    r1 = cache_client.complete(test_messages, temperature=0, max_tokens=5)
    print(f"Call 1 (miss):  {r1}")

    # Second call: identical → cache hit, no API call made
    r2 = cache_client.complete(test_messages, temperature=0, max_tokens=5)
    print(f"Call 2 (hit):   {r2}")

    # Third call: same again
    r3 = cache_client.complete(test_messages, temperature=0, max_tokens=5)
    print(f"Call 3 (hit):   {r3}")

    print(f"Cache stats: {cache_client.cache_stats()}")
    print("After 3 calls: 1 API call, 2 cache hits = 67% cost reduction")

    # 3. Batch processing with concurrency control
    print("\n\n=== Batch Processing with Concurrency Limit ===")
    texts = [
        "Absolutely love this product!",
        "Worst purchase ever, total waste.",
        "It's okay, nothing special.",
        "Works great, would buy again.",
        "Arrived damaged, very disappointed.",
        "Decent quality for the price.",
    ]

    import time
    start = time.perf_counter()
    results = asyncio.run(
        process_batch_with_limits(texts, api_key, concurrency=3)
    )
    elapsed = time.perf_counter() - start

    print(f"Processed {len(texts)} texts in {elapsed:.2f}s (concurrency=3)")
    for text, result in zip(texts, results):
        print(f"  {result:10s} | {text[:50]}")

    print("\nNote: Without semaphore, all 6 would fire simultaneously → rate limit.")
    print("With semaphore(3): max 3 concurrent calls, queue the rest.")
