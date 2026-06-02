# Chapter 3: LLM APIs in Production
## Rate Limits, Retries, Streaming, and Cost Optimization

---

## Mental Model (How to Think About This as an Engineer)

Forget the playground. When you hit an LLM API in production, you are:

1. **Making network calls** — with all the failure modes that implies (timeouts, rate limits, transient errors)
2. **Paying per token** — cost is a first-class engineering constraint, not an afterthought
3. **Waiting for slow I/O** — LLMs are 10–100x slower than database queries and must be treated as such
4. **Consuming a shared resource** — rate limits are real and will bite you at scale

The mental model is: **treat LLM API calls like expensive, slow, unreliable database queries that can also time out, rate-limit, and return semantically wrong results.**

Everything that good distributed systems engineers do for unreliable external services applies here — plus a layer of cost accounting that has no equivalent in traditional APIs.

```
Traditional API Call                LLM API Call
───────────────────                 ────────────────────
Fast (< 50ms)                       Slow (1–30 seconds)
Fixed cost (infra only)             Variable cost (per token)
Deterministic output                Probabilistic output
Simple error types                  Complex failure modes
Rate limits: easy to avoid          Rate limits: aggressive, complex
```

---

## What Actually Happens When You Call the LLM API

Before engineering around the API, understand what physically happens:

```
YOUR APPLICATION
      │
      │ HTTP POST /v1/chat/completions
      │ (JSON body: model, messages, params)
      ▼
┌──────────────────────────────────────────────┐
│           PROVIDER INFRASTRUCTURE            │
│                                              │
│  1. Auth & rate limit check (< 1ms)          │
│  2. Request queued to GPU cluster            │
│  3. Tokenize input                           │
│  4. Load/locate model weights (KV cache)     │
│  5. Prefill pass: process ALL input tokens   │
│     in parallel (cost: O(n_input_tokens))    │
│  6. Decode pass: generate ONE token at a     │
│     time, autoregressively                   │
│     (cost: O(n_output_tokens) serial steps)  │
│  7. Stream tokens back via SSE, OR           │
│     buffer all and return at once            │
└──────────────────────────────────────────────┘
      │
      ▼
YOUR APPLICATION receives response
```

Key insight: **Prefill is fast and parallel. Decode is slow and serial.** Each output token requires one full forward pass through the transformer. This is why:
- Long outputs take much longer than short outputs
- Output tokens cost more than input tokens (they require more compute per token)
- Streaming feels faster even though total time is the same

---

## Rate Limits: How They Actually Work

Rate limits are **not** simple request counters. Most providers enforce multiple overlapping limits simultaneously.

### OpenAI Rate Limit Types

```
┌──────────────────────────────────────────────────────────────┐
│                    OPENAI RATE LIMITS                        │
│                                                              │
│  Per-minute limits (all applied simultaneously):            │
│                                                              │
│  RPM  = Requests Per Minute                                  │
│         e.g., 3,000 RPM for gpt-4o (tier 1)                │
│                                                              │
│  TPM  = Tokens Per Minute (input + output)                  │
│         e.g., 150,000 TPM for gpt-4o (tier 1)              │
│                                                              │
│  RPD  = Requests Per Day                                     │
│         e.g., no limit on higher tiers                      │
│                                                              │
│  You hit a limit if ANY of these is exceeded.               │
│  A single large request can exhaust your TPM                │
│  without using many RPM.                                    │
└──────────────────────────────────────────────────────────────┘
```

### What a Rate Limit Response Looks Like

```json
{
  "error": {
    "message": "Rate limit reached for gpt-4o in organization org-xxx on tokens per min (TPM)...",
    "type": "requests",
    "code": "rate_limit_exceeded"
  }
}
```

HTTP status: `429 Too Many Requests`

Response headers tell you exactly what happened:
```
x-ratelimit-limit-requests: 3000
x-ratelimit-limit-tokens: 150000
x-ratelimit-remaining-requests: 0
x-ratelimit-remaining-tokens: 23456
x-ratelimit-reset-requests: 1s
x-ratelimit-reset-tokens: 6s
retry-after: 6
```

**Always read the `retry-after` header.** It tells you exactly how long to wait. Don't guess.

---

## Retry Logic: The Production Pattern

Naive retry = disaster. Here is the correct pattern:

```
┌─────────────────────────────────────────────────────────┐
│                RETRY DECISION TREE                       │
│                                                          │
│  Error received                                          │
│      │                                                   │
│      ├── 429 Rate Limit → Retry (with backoff)           │
│      ├── 500 Server Error → Retry (transient)            │
│      ├── 503 Service Unavailable → Retry                 │
│      ├── 504 Gateway Timeout → Retry                     │
│      │                                                   │
│      ├── 400 Bad Request → DO NOT RETRY (your fault)     │
│      ├── 401 Unauthorized → DO NOT RETRY (auth issue)    │
│      ├── 404 Not Found → DO NOT RETRY (wrong endpoint)   │
│      └── connection timeout → Retry (check total elapsed)│
└─────────────────────────────────────────────────────────┘
```

The correct backoff strategy for 429s specifically:

```python
import time
import random

def retry_after_from_headers(response) -> float:
    """Extract exact wait time from provider headers."""
    retry_after = response.headers.get("retry-after")
    if retry_after:
        return float(retry_after)
    # Fallback if header missing
    return 60.0

def llm_call_with_retry(client, messages, max_retries=3):
    attempt = 0
    while attempt <= max_retries:
        try:
            return client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
            )
        except openai.RateLimitError as e:
            if attempt == max_retries:
                raise
            # Use provider's retry-after header, NOT your own timer
            wait = float(e.response.headers.get("retry-after", 60))
            # Add jitter to prevent thundering herd
            wait += random.uniform(0, wait * 0.1)
            print(f"Rate limited. Waiting {wait:.1f}s (attempt {attempt + 1})")
            time.sleep(wait)
            attempt += 1
        except openai.APIStatusError as e:
            if e.status_code in (500, 502, 503, 504):
                if attempt == max_retries:
                    raise
                # Exponential backoff for server errors
                wait = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait)
                attempt += 1
            else:
                raise  # Client errors: don't retry
```

### Exponential Backoff with Jitter

```
Naive exponential:    1s, 2s, 4s, 8s, 16s
Problem: All callers retry at the same time (thundering herd)

With jitter:          1.2s, 2.7s, 3.1s, 9.4s, 17.8s
Callers spread out, preventing synchronized retry storms
```

**Tenacity** is the production library for this:

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential_jitter,
    retry_if_exception_type,
    RetryCallState,
)
import openai

def before_retry_log(retry_state: RetryCallState):
    print(f"Retry attempt {retry_state.attempt_number}, "
          f"waiting {retry_state.next_action.sleep:.1f}s")

@retry(
    retry=retry_if_exception_type((openai.RateLimitError, openai.APIStatusError)),
    wait=wait_exponential_jitter(initial=1, max=60, jitter=5),
    stop=stop_after_attempt(5),
    before_sleep=before_retry_log,
)
def call_llm(client, messages):
    return client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
```

---

## Streaming: How and Why

### Why Stream?

```
WITHOUT streaming:
  User submits → 8 seconds of nothing → Full response appears

  Time-to-first-byte: 8 seconds
  Perceived latency: HIGH
  User experience: blank screen feels broken

WITH streaming:
  User submits → 200ms → first word appears → continuous text flow

  Time-to-first-byte: 200ms (just the prefill time)
  Total time: same 8 seconds
  User experience: feels fast and responsive
```

Streaming doesn't reduce total generation time. It reduces **perceived latency** by showing output as it's generated. This is critical for user-facing applications.

### How Streaming Works (SSE)

The API uses **Server-Sent Events (SSE)** — a simple HTTP streaming protocol:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"The"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":" capital"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":" is"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":" Paris"},"finish_reason":null}]}

data: {"choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

Each SSE event contains one token (or sometimes a small batch of tokens). The connection stays open until the model finishes or hits a stop condition.

### Streaming in Code

```python
import openai

client = openai.OpenAI()

# Non-streaming (wait for full response)
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain async/await in Python"}],
)
print(response.choices[0].message.content)


# Streaming (token by token)
with client.chat.completions.stream(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain async/await in Python"}],
) as stream:
    for text_chunk in stream.text_stream:
        print(text_chunk, end="", flush=True)
    print()  # newline at end

    # After stream completes, final usage is available:
    final_completion = stream.get_final_completion()
    print(f"\nInput tokens:  {final_completion.usage.prompt_tokens}")
    print(f"Output tokens: {final_completion.usage.completion_tokens}")
```

### Streaming in FastAPI (SSE endpoint)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import openai
import json

app = FastAPI()
client = openai.OpenAI()

async def generate_stream(user_message: str):
    """Generator that yields SSE-formatted chunks."""
    with client.chat.completions.stream(
        model="gpt-4o",
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            # Format as SSE
            yield f"data: {json.dumps({'content': text})}\n\n"
    yield "data: [DONE]\n\n"

@app.get("/chat/stream")
async def chat_stream(message: str):
    return StreamingResponse(
        generate_stream(message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Critical: disables Nginx buffering
        },
    )
```

### ⚠️ Production Streaming Pitfalls

```
1. Nginx buffering: By default, Nginx buffers responses.
   SSE will not stream until the buffer fills up.
   Fix: X-Accel-Buffering: no header, or proxy_buffering off in nginx.conf

2. Usage stats not available during stream:
   Token counts come only in the final chunk (or after stream ends).
   You cannot know cost until the stream is complete.

3. Interruption handling:
   If the client disconnects mid-stream, you're still paying for tokens generated.
   Implement disconnect detection on the server side.

4. Aggregating streamed content:
   If you need to process the full output (e.g., parse JSON), you must
   collect all chunks first. Streaming + JSON parsing don't mix.
```

---

## Async API Calls (The Correct Production Pattern)

If you're building a web service that makes LLM calls, **synchronous calls will block your server**.

```
SYNC (wrong for web services):
  Request 1 arrives → LLM call → 8 seconds blocked → Response
  Request 2 arrives → WAITING for request 1 to finish
  Request 3 arrives → WAITING

  With a single-threaded sync server, you handle 1 request at a time.
  LLM latency = your server throughput bottleneck.

ASYNC (correct):
  Request 1 arrives → LLM call started (non-blocking) → continue
  Request 2 arrives → LLM call started (non-blocking) → continue
  Request 3 arrives → LLM call started (non-blocking) → continue
  Response 2 ready → yield to event loop → send
  Response 1 ready → yield to event loop → send
  Response 3 ready → yield to event loop → send

  Throughput: limited by rate limits, not server thread count.
```

```python
import asyncio
import openai

# Use AsyncOpenAI, not OpenAI
client = openai.AsyncOpenAI()

async def classify_sentiment(text: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Reply with only: POSITIVE, NEGATIVE, or NEUTRAL"},
            {"role": "user", "content": text},
        ],
        max_tokens=5,  # Force short output → lower cost + latency
    )
    return response.choices[0].message.content.strip()


async def process_batch(texts: list[str]) -> list[str]:
    """
    Process multiple texts concurrently.
    This is NOT rate-limit-safe — see the rate-limited version below.
    """
    tasks = [classify_sentiment(text) for text in texts]
    return await asyncio.gather(*tasks)


# Rate-limit-safe batch processing with semaphore
async def process_batch_limited(texts: list[str], concurrency: int = 10) -> list[str]:
    """
    Limit concurrent LLM calls to avoid rate limits.
    concurrency = max simultaneous API calls.
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def limited_classify(text: str) -> str:
        async with semaphore:
            return await classify_sentiment(text)

    tasks = [limited_classify(text) for text in texts]
    return await asyncio.gather(*tasks)


# Usage
async def main():
    texts = [
        "Great product, works perfectly!",
        "Terrible, broke after two days.",
        "It's fine, nothing special.",
    ]
    results = await process_batch_limited(texts, concurrency=5)
    for text, sentiment in zip(texts, results):
        print(f"{sentiment}: {text[:40]}")

asyncio.run(main())
```

---

## Cost Optimization: The Engineering Levers

### Token Counting Before Sending

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens before making the API call."""
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    model: str = "gpt-4o"
) -> float:
    """Estimate cost in USD."""
    # Prices as of mid-2025 — always check provider pricing page
    pricing = {
        "gpt-4o":          {"input": 2.50, "output": 10.00},   # per 1M tokens
        "gpt-4o-mini":     {"input": 0.15, "output": 0.60},
        "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
        "claude-3-haiku":  {"input": 0.25, "output": 1.25},
    }
    p = pricing[model]
    return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000
```

### Model Selection by Task Complexity

This is the highest-leverage cost optimization:

```
┌──────────────────────────────────────────────────────────────┐
│                MODEL SELECTION MATRIX                        │
│                                                              │
│  Task Type              Best Model          Why              │
│  ─────────────────────────────────────────────────────────  │
│  Simple classification  gpt-4o-mini         17x cheaper      │
│  Sentiment, tagging     claude-3-haiku      fast + cheap     │
│  Data extraction (JSON) gpt-4o-mini         reliable + cheap │
│  Complex reasoning      gpt-4o / claude-3.5 worth the cost   │
│  Code generation        gpt-4o / claude-3.5 quality matters  │
│  RAG summarization      gpt-4o-mini         input is context │
│  Embeddings             text-embedding-3-small always cheapest│
│                                                              │
│  Rule: Start with the cheapest model that meets your         │
│  quality bar. Escalate only when you have eval data.         │
└──────────────────────────────────────────────────────────────┘
```

### `max_tokens`: The Safety Valve

Always set `max_tokens`. Without it, a poorly-prompted model can generate thousands of tokens.

```python
# For a task that should return "POSITIVE" or "NEGATIVE":
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    max_tokens=5,       # ← Forces short output
    temperature=0,      # ← Deterministic output
)
# Without max_tokens=5, model might generate a paragraph explanation
# You'd pay for 200 output tokens instead of 1
```

### Prompt Caching

Providers cache repeated prompt prefixes. The longer the static prefix, the more you save.

```
ANTHROPIC PROMPT CACHING:
  Cache write: 1.25x normal input price (first time)
  Cache read:  0.10x normal input price (subsequent calls)

  Break-even: after ~2 cache reads, you're saving money.

  ┌─────────────────────────────────────────────────────┐
  │  messages = [                                        │
  │    {                                                 │
  │      "role": "user",                                │
  │      "content": [                                   │
  │        {                                            │
  │          "type": "text",                            │
  │          "text": "Your 2000-token system prompt...",│
  │          "cache_control": {"type": "ephemeral"}     │  ← Cache this prefix
  │        },                                           │
  │        {                                            │
  │          "type": "text",                            │
  │          "text": actual_user_query                  │  ← This changes each call
  │        }                                            │
  │      ]                                              │
  │    }                                                │
  │  ]                                                  │
  └─────────────────────────────────────────────────────┘
```

### Response Caching (Your Side)

For deterministic tasks, cache the response entirely:

```python
import hashlib
import json
import redis

redis_client = redis.Redis(host="localhost", port=6379, db=0)

def cache_key(model: str, messages: list) -> str:
    """Stable hash of the request for cache lookup."""
    payload = json.dumps({"model": model, "messages": messages}, sort_keys=True)
    return f"llm:{hashlib.sha256(payload.encode()).hexdigest()}"

async def cached_llm_call(model: str, messages: list, ttl_seconds: int = 3600):
    key = cache_key(model, messages)

    # Check cache first
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)

    # Cache miss: call API
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,  # Must be deterministic to cache reliably
    )
    result = response.choices[0].message.content

    # Store in cache
    redis_client.setex(key, ttl_seconds, json.dumps(result))
    return result
```

**Critical rule:** Only cache when `temperature=0`. Caching stochastic outputs can serve stale or wrong results that you can't detect.

---

## The Context Window: A Hard Engineering Constraint

The context window is **not a soft limit**. It's a hard cap on total tokens (input + output) in a single call.

```
Model               Context Window    Practical Notes
──────────────────────────────────────────────────────
gpt-4o              128K tokens       ~96,000 words
gpt-4o-mini         128K tokens       same
claude-3.5-sonnet   200K tokens       ~150,000 words
gemini-1.5-pro      1M+ tokens        very long docs

128K tokens ≈ a 300-page book
```

### What happens when you hit the limit

The API returns a `context_length_exceeded` error (400). The model does **not** truncate silently — it fails hard.

```python
# Defensive: truncate before sending
def truncate_messages_to_budget(
    messages: list[dict],
    model: str,
    max_input_tokens: int,
) -> list[dict]:
    """
    Remove oldest messages from conversation history until
    total tokens fit within budget.
    """
    enc = tiktoken.encoding_for_model(model)

    while True:
        total_tokens = sum(
            len(enc.encode(m["content"])) for m in messages
        )
        if total_tokens <= max_input_tokens:
            return messages
        # Remove the oldest non-system message
        if len(messages) <= 1:
            raise ValueError("Single message exceeds token budget")
        # Keep system message (index 0), remove oldest user/assistant message
        messages = [messages[0]] + messages[2:]
```

### Cost as a function of context

```
GPT-4o: $2.50 per million input tokens

Single call with 10K input tokens: $0.025
Single call with 100K input tokens: $0.25

At 10,000 requests/day:
  10K tokens/call:  10,000 × $0.025 = $250/day
  100K tokens/call: 10,000 × $0.25  = $2,500/day

Context window size has a 10x effect on cost.
Keep prompts tight.
```

---

## Complete Production Client Pattern

Putting it all together — a production-grade LLM client:

```python
import asyncio
import hashlib
import json
import logging
import random
import time
from typing import Optional

import openai
import redis
import tiktoken
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)


class ProductionLLMClient:
    def __init__(
        self,
        api_key: str,
        redis_url: str = "redis://localhost:6379",
        default_model: str = "gpt-4o-mini",
        max_concurrency: int = 10,
    ):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.redis = redis.from_url(redis_url)
        self.default_model = default_model
        self.semaphore = asyncio.Semaphore(max_concurrency)

    def _cache_key(self, model: str, messages: list, **kwargs) -> str:
        payload = json.dumps(
            {"model": model, "messages": messages, **kwargs}, sort_keys=True
        )
        return f"llm:{hashlib.sha256(payload.encode()).hexdigest()}"

    def _count_tokens(self, messages: list, model: str) -> int:
        enc = tiktoken.encoding_for_model(model)
        return sum(len(enc.encode(m["content"])) for m in messages)

    @retry(
        retry=retry_if_exception_type(
            (openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)
        ),
        wait=wait_exponential_jitter(initial=1, max=60, jitter=5),
        stop=stop_after_attempt(4),
    )
    async def _raw_call(self, model: str, messages: list, **kwargs) -> str:
        """Single API call, decorated with retry logic."""
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content

    async def complete(
        self,
        messages: list,
        model: Optional[str] = None,
        temperature: float = 0,
        max_tokens: int = 1024,
        use_cache: bool = True,
        cache_ttl: int = 3600,
    ) -> str:
        model = model or self.default_model

        # Cache lookup (only for deterministic calls)
        if use_cache and temperature == 0:
            cache_key = self._cache_key(model, messages, max_tokens=max_tokens)
            cached = self.redis.get(cache_key)
            if cached:
                logger.info("LLM cache hit")
                return json.loads(cached)

        # Log token count for monitoring
        input_tokens = self._count_tokens(messages, model)
        logger.info(f"LLM call: model={model}, input_tokens={input_tokens}")

        # Enforce concurrency limit
        async with self.semaphore:
            result = await self._raw_call(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        # Cache result
        if use_cache and temperature == 0:
            self.redis.setex(cache_key, cache_ttl, json.dumps(result))

        return result
```

---

## ASCII Architecture: Production LLM Call Flow

```
YOUR SERVICE
    │
    ▼
┌──────────────────┐
│  Cache Check     │──── HIT ────────────────────────────────► Return cached
│  (Redis)         │
└────────┬─────────┘
         │ MISS
         ▼
┌──────────────────┐
│ Token Counter    │──── Too large? ──► Truncate / split / error
│ (tiktoken)       │
└────────┬─────────┘
         │ Within budget
         ▼
┌──────────────────┐
│ Semaphore        │──── At concurrency limit? ──► Queue (wait)
│ (rate control)   │
└────────┬─────────┘
         │ Slot available
         ▼
┌──────────────────┐     ┌───────────────────────────────┐
│  Retry Wrapper   │────►│         LLM API               │
│  (tenacity)      │◄────│  (OpenAI / Anthropic / etc.)  │
│                  │     └───────────────────────────────┘
│  429 → wait      │
│  500 → backoff   │
│  400 → raise     │
└────────┬─────────┘
         │ Success
         ▼
┌──────────────────┐
│  Store to Cache  │
│  (Redis, TTL)    │
└────────┬─────────┘
         │
         ▼
    Return result + log metrics
```

---

## OpenAI vs. Anthropic vs. Gemini: Engineering Differences

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROVIDER COMPARISON (ENGINEERING)                 │
├────────────────┬──────────────┬──────────────────┬──────────────────┤
│ Feature        │ OpenAI       │ Anthropic         │ Google Gemini    │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Structured     │ Excellent    │ Good (tool use)   │ Good             │
│ output         │ (Pydantic    │                   │                  │
│                │  native)     │                   │                  │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Streaming      │ Full support │ Full support      │ Full support     │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Prompt caching │ Auto (GPT-4) │ Explicit API      │ Automatic        │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Batch API      │ Yes (50%     │ Yes (50% off,     │ No (use standard)│
│                │  off, async) │  async)           │                  │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Context window │ 128K         │ 200K              │ 1M+              │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Rate limits    │ Token-based, │ Token-based,      │ RPM + TPM        │
│                │ complex tiers│ complex tiers     │                  │
├────────────────┼──────────────┼──────────────────┼──────────────────┤
│ Error codes    │ 429, 500,    │ 529 (overloaded)  │ 429, 503         │
│                │ 503, 400     │ 400, 429          │                  │
└────────────────┴──────────────┴──────────────────┴──────────────────┘
```

### The Batch API — The Hidden Cost Weapon

If your use case allows **asynchronous processing** (not real-time), use the Batch API:

```python
# OpenAI Batch API: 50% cost reduction, 24-hour turnaround

import json
import openai

client = openai.OpenAI()

# Step 1: Prepare batch file
requests = []
for i, text in enumerate(texts_to_classify):
    requests.append({
        "custom_id": f"request-{i}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "Classify sentiment: POSITIVE, NEGATIVE, or NEUTRAL"},
                {"role": "user", "content": text},
            ],
            "max_tokens": 5,
        }
    })

# Write to JSONL file
with open("batch_input.jsonl", "w") as f:
    for req in requests:
        f.write(json.dumps(req) + "\n")

# Step 2: Upload and create batch
batch_file = client.files.create(
    file=open("batch_input.jsonl", "rb"),
    purpose="batch"
)

batch = client.batches.create(
    input_file_id=batch_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
)

print(f"Batch created: {batch.id}")
# Poll or webhook: batch.status in ["validating", "in_progress", "completed", "failed"]
```

Use cases where batch API is perfect:
- Nightly data processing pipelines
- Generating embeddings for large document sets
- Evaluating model outputs at scale
- Content moderation queues

---

## What Engineers Assume vs. What Actually Happens

| Assumption | Reality |
|---|---|
| "Rate limits are just request counts" | They're multi-dimensional: RPM + TPM + RPD all simultaneously enforced |
| "Streaming is faster" | Same total time; lower perceived latency only |
| "Retry on any error" | Retrying 400 errors wastes time and can cause infinite loops |
| "Context window = free RAM" | Every token in context costs money on every call |
| "Higher temperature = more creative" | Higher temperature = more random, not more creative |
| "The model will tell me if I exceed context" | It throws a 400 error — your app must handle this |
| "Caching is optional" | At scale, prompt caching is often the single biggest cost reduction |

---

## Common Engineering Mistakes & Production Pitfalls

⚠️ **Mistake 1: No `max_tokens` set**
An unconstrained call to an over-eager model can generate 4096 tokens when you needed 10. Always cap output tokens.

⚠️ **Mistake 2: Synchronous LLM calls in a web handler**
Your server becomes single-threaded against LLM latency. Always use async client in async web frameworks.

⚠️ **Mistake 3: Retrying 400 errors**
Bad request errors (wrong schema, content policy violation) will not succeed on retry. You're burning API budget.

⚠️ **Mistake 4: No concurrency limit on async batch**
`asyncio.gather(1000 tasks)` fires 1000 simultaneous API calls. You'll be rate limited instantly. Use a Semaphore.

⚠️ **Mistake 5: Caching at temperature > 0**
Non-deterministic responses should never be cached — you'll serve a single random output to all users.

⚠️ **Mistake 6: Ignoring the `retry-after` header**
Guessing the wait time wastes time or hammers the API. The provider gives you the exact value — use it.

⚠️ **Mistake 7: Using GPT-4o for everything**
For simple classification at 10K requests/day: GPT-4o costs 17x more than GPT-4o-mini with equivalent quality on simple tasks. Profile first, optimize model selection.

---

## Prediction Exercise

Before moving to Chapter 4, think about this:

> You have a RAG pipeline that sends 5,000 tokens of retrieved context + 200 tokens of user query to `gpt-4o` on every request. You have 10,000 users/day. Your bill is $1,250/day just on input tokens.
>
> **What are the three highest-leverage changes you could make to reduce cost by 80% without significantly degrading quality?**

Think through it before reading the next chapter.

_(Answer covered in the RAG pipeline chapter — but reason through it now.)_
