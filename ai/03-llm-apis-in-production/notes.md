# Chapter 3 — Revision Notes
## LLM APIs in Production: Senior Engineer's Cheat Sheet

---

### The One Mental Model

> LLM API calls = expensive, slow, unreliable external service calls.
> Apply everything you know about distributed systems resilience — plus token cost accounting.

---

### Rate Limits: The Real Structure

```
NOT just RPM. Three simultaneous limits:
  RPM  = Requests Per Minute
  TPM  = Tokens Per Minute (input + output combined)
  RPD  = Requests Per Day

You can hit TPM while staying under RPM.
A single 50K-token request can consume 33% of your per-minute token budget.
Always read the retry-after header — it gives the exact wait time.
```

---

### Retry Decision Matrix

| Error Code | Retry? | Strategy |
|-----------|--------|----------|
| 429 | ✅ Yes | Wait `retry-after` header + jitter |
| 500, 502, 503, 504 | ✅ Yes | Exponential backoff with jitter |
| 400 Bad Request | ❌ No | Fix your request |
| 401 Unauthorized | ❌ No | Fix auth |
| 404 Not Found | ❌ No | Fix endpoint |
| Connection timeout | ✅ Yes | With total timeout budget |

**Use tenacity for retry logic. Never hand-roll.**

---

### Streaming: What It Does and Doesn't Do

- **Does:** Reduce perceived latency (time-to-first-token ~200ms vs 8s)
- **Doesn't:** Reduce total generation time
- **Gotcha 1:** Nginx buffers SSE by default → `X-Accel-Buffering: no`
- **Gotcha 2:** Token usage only available after stream ends
- **Gotcha 3:** If you need to parse JSON output, don't stream — collect all chunks first

---

### Async: Required for Web Services

```python
# WRONG: blocks entire server for 8+ seconds per request
response = client.chat.completions.create(...)

# CORRECT: async, non-blocking
response = await async_client.chat.completions.create(...)

# CORRECT: concurrency-limited batch
semaphore = asyncio.Semaphore(10)  # max 10 concurrent LLM calls
async with semaphore:
    result = await async_call(...)
```

---

### Cost Optimization Levers (Highest to Lowest Impact)

1. **Model selection** — gpt-4o-mini is 17x cheaper than gpt-4o. Match model to task complexity.
2. **Prompt caching** — Static system prompts cached at 10% of normal input price (Anthropic)
3. **Response caching** — Cache at temperature=0 only. Redis + SHA256 key of request.
4. **Batch API** — 50% cost reduction for async workloads (nightly pipelines, bulk processing)
5. **`max_tokens`** — Always set. Prevents runaway output on bad prompts.
6. **Context trimming** — Shorter prompts = cheaper. Remove unnecessary context.

---

### Context Window Engineering

```
Context window = hard limit, not a guideline.
Hitting it = 400 error, not graceful truncation.

Strategy:
1. Count tokens BEFORE sending (tiktoken)
2. Truncate conversation history from the oldest messages
3. Keep system prompt intact
4. Reserve budget for output: max_input = context_window - max_tokens
```

---

### Caching Rules

| Situation | Cache? |
|-----------|--------|
| temperature=0, deterministic | ✅ Yes, safe |
| temperature > 0 | ❌ No, serves stale random output |
| Streaming response | ❌ No (collect first, then cache) |
| User-specific content | ❌ No (privacy: don't share across users) |
| Classification / extraction tasks | ✅ Yes (same input → same output) |

---

### Production Client Checklist

- [ ] Async client (`AsyncOpenAI`, `AsyncAnthropic`)
- [ ] Retry logic with tenacity (429 + 5xx only)
- [ ] Concurrency semaphore to stay under rate limits
- [ ] `max_tokens` set on every call
- [ ] Token counter before sending (prevent 400 errors)
- [ ] Response cache (Redis, keyed by SHA256 of request)
- [ ] Metrics: log model, input_tokens, output_tokens, latency per call
- [ ] `X-Accel-Buffering: no` header for streaming endpoints

---

### Key Terms

| Term | Definition |
|------|-----------|
| **RPM / TPM / RPD** | Rate limit dimensions: requests/min, tokens/min, requests/day |
| **SSE** | Server-Sent Events: HTTP streaming protocol used for LLM token streaming |
| **Prefill** | Processing all input tokens in parallel (fast, O(n)) |
| **Decode** | Generating output tokens one at a time (slow, serial) |
| **Prompt caching** | Provider-side caching of repeated prompt prefixes |
| **Constrained decoding** | Token sampler filtered to produce valid JSON/schema |
| **Batch API** | Async bulk request processing at 50% cost reduction |
| **Thundering herd** | All retrying clients hitting API simultaneously |
| **Jitter** | Random delay added to backoff to spread retry load |

---

### The Three Numbers Every Production LLM Engineer Knows

```
1. Your model's cost per 1M tokens (input + output separately)
2. Your average input/output token count per request
3. Your requests per day → daily cost = (1) × (2) × (3)
```

If you can't calculate your daily LLM cost in under 30 seconds, you're flying blind.
