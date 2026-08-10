# Chapter 3 Exercise — LLM APIs in Production

**Scope:** Retry logic · rate limits · streaming · async concurrency · cost optimization  
**Estimated time:** 45–60 minutes  
**Rules:** Write all code yourself. Do not use AI to generate the solution.

---

## Problem: Production-Hardened LLM Client

The bare `AsyncOpenAI()` client is not production-ready. You will wrap it with all the
resilience patterns an engineer should add before shipping any LLM-powered feature.

---

## Acceptance Criteria

- [ ] Retry on 429 and 5xx errors only (not on 400/401/404)
- [ ] Respects `retry-after` header on 429 responses
- [ ] Falls back to exponential backoff + jitter if `retry-after` is absent
- [ ] Max 3 retry attempts total
- [ ] Concurrency bounded to 5 simultaneous calls (semaphore)
- [ ] `max_tokens` enforced on every call
- [ ] Each call logs: model, input_tokens, output_tokens, latency_ms, attempt_count
- [ ] Streaming variant that prints tokens as they arrive
- [ ] A context window guard: raises a clear error if input tokens exceed a safe limit

---

## Starter Skeleton

Save as `exercises/solution/hardened_client.py`:

```python
import asyncio
import logging
import random
import time
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI, APIStatusError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
    RetryCallState,
)
import tiktoken

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ENCODING = tiktoken.get_encoding("cl100k_base")
MAX_SAFE_INPUT_TOKENS = 4_000   # Leave headroom for output
MAX_CONCURRENT_CALLS = 5
DEFAULT_MAX_TOKENS = 500


@dataclass
class LLMCallResult:
    content: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    attempt_count: int


# TODO: Implement should_retry(exception) → bool
# Return True only for 429 and 5xx errors
def should_retry(exc: BaseException) -> bool:
    pass


# TODO: Implement get_retry_after(exc) → float | None
# Extract the retry-after header value (in seconds) if present, else None
def get_retry_after(exc: BaseException) -> float | None:
    pass


# TODO: Implement count_tokens(messages) → int
# Count the total tokens across all messages using tiktoken
def count_tokens(messages: list[dict]) -> int:
    pass


# TODO: Implement the hardened_call() function
# It should:
# 1. Count input tokens and raise ValueError if above MAX_SAFE_INPUT_TOKENS
# 2. Use tenacity @retry decorator with should_retry predicate
# 3. Respect retry-after header when present (replace default backoff wait)
# 4. Enforce max_tokens on every call
# 5. Record start/end time for latency
# 6. Log model, input_tokens, output_tokens, latency_ms, attempt on every call
# 7. Return an LLMCallResult
async def hardened_call(
    messages: list[dict],
    model: str = "gpt-4o-mini",
    max_tokens: int = DEFAULT_MAX_TOKENS,
    client: AsyncOpenAI | None = None,
) -> LLMCallResult:
    pass


# TODO: Implement streaming_call()
# Same inputs as hardened_call but streams tokens to stdout as they arrive
# Print each token chunk without newline (end="", flush=True)
# Return the full assembled content string when done
async def streaming_call(
    messages: list[dict],
    model: str = "gpt-4o-mini",
    max_tokens: int = DEFAULT_MAX_TOKENS,
    client: AsyncOpenAI | None = None,
) -> str:
    pass


# TODO: Implement batch_calls()
# Takes a list of message lists, runs them all concurrently with MAX_CONCURRENT_CALLS semaphore
# Returns a list of LLMCallResult (or Exception for any that failed)
# Use asyncio.gather(return_exceptions=True)
async def batch_calls(
    all_messages: list[list[dict]],
    model: str = "gpt-4o-mini",
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> list[LLMCallResult | Exception]:
    pass


# ── Test runner ───────────────────────────────────────────────────────────────
async def main():
    client = AsyncOpenAI()

    print("\n=== Test 1: Single hardened call ===")
    result = await hardened_call(
        messages=[{"role": "user", "content": "Say 'hello' in 5 languages, one per line."}],
        client=client,
    )
    print(f"Response: {result.content[:100]}...")
    print(f"Tokens: {result.input_tokens} in / {result.output_tokens} out | {result.latency_ms:.0f}ms")

    print("\n=== Test 2: Streaming call ===")
    print("Streaming: ", end="")
    content = await streaming_call(
        messages=[{"role": "user", "content": "Count from 1 to 10."}],
        client=client,
    )
    print(f"\nFull response ({len(content)} chars)")

    print("\n=== Test 3: Batch of 8 calls (bounded to 5 concurrent) ===")
    prompts = [
        [{"role": "user", "content": f"What is {i} × {i}?"}]
        for i in range(1, 9)
    ]
    results = await batch_calls(prompts, client=client)
    successes = sum(1 for r in results if not isinstance(r, Exception))
    print(f"Completed: {successes}/{len(prompts)} succeeded")

    print("\n=== Test 4: Context window guard ===")
    try:
        giant_message = [{"role": "user", "content": "word " * 5000}]
        await hardened_call(giant_message, client=client)
        print("ERROR: Should have raised ValueError")
    except ValueError as e:
        print(f"✅ Correctly rejected: {e}")


if __name__ == "__main__":
    asyncio.run(main())
```

---

## What to Verify

- [ ] **Test 1** runs and logs: `INFO ... model=gpt-4o-mini input_tokens=N output_tokens=N latency_ms=N`
- [ ] **Test 2** prints tokens as they stream (you see them appear one by one, not all at once)
- [ ] **Test 3** completes 8 calls but the total time proves max 5 ran simultaneously (check logs — they should show overlapping calls)
- [ ] **Test 4** raises `ValueError` with a message explaining the token count exceeded the limit

**Simulate a 429:** Temporarily set `max_tokens=1` and make 20 rapid requests. Watch tenacity retry with backoff in the logs. (Or just inspect the code logic — a real 429 simulation requires rate limit context.)

---

## Hints

<details>
<summary>Hint 1 — Detecting 429 vs 5xx with tenacity</summary>

```python
from openai import APIStatusError

def should_retry(exc: BaseException) -> bool:
    if isinstance(exc, APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    if isinstance(exc, APIConnectionError):
        return True  # Network errors are always retryable
    return False
```

</details>

<details>
<summary>Hint 2 — Using tenacity with a custom predicate</summary>

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

@retry(
    retry=retry_if_exception(should_retry),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
async def _call_with_retry(...):
    ...
```

</details>

<details>
<summary>Hint 3 — Respecting retry-after header</summary>

The `retry-after` header is available via `exc.response.headers.get("retry-after")`.
To override tenacity's wait, use a `before_sleep` callback that reads from the exception.

Alternatively: extract it before raising and implement your own `await asyncio.sleep(wait)` in
a manual retry loop (simpler to understand, though tenacity is preferred in production).

</details>

<details>
<summary>Hint 4 — Counting attempt number in tenacity</summary>

Use `reraise=True` and wrap the `@retry` function in another function that captures
attempt count from `tenacity`'s `RetryCallState`, or simply use a mutable counter:
`attempt_count = [0]` and increment inside the retry function.

</details>
