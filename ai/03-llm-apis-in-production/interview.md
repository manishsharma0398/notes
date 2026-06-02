# Chapter 3 — Interview Questions
## LLM APIs in Production

---

### Question 1
**"Design a production LLM API client for a service handling 50,000 requests/day with p99 latency requirements of < 15 seconds."**

**What they're testing:** Retry logic, async design, concurrency control, cost awareness, observability.

**Strong answer covers:**
- Async client (non-blocking) with `asyncio.Semaphore` for concurrency control
- Retry: tenacity with exponential backoff + jitter, only on 429/5xx
- Prompt caching for static system prompts (cost reduction)
- Response caching in Redis for temperature=0 deterministic calls
- Circuit breaker pattern: if provider is down, fail fast rather than queue up
- Metrics: latency histogram, token counts, cache hit rate, error rate by code
- Model routing: use gpt-4o-mini for simple tasks, escalate to gpt-4o only when needed
- Budget: 50K req/day × avg cost/req = daily budget projection

**Cost math:**
```
50K req/day × 3K input tokens × $0.15/M (gpt-4o-mini) = $22.50/day input
50K req/day × 200 output tokens × $0.60/M             = $6.00/day output
Total: ~$28.50/day = $855/month — very manageable
```

---

### Question 2
**"What breaks if you scale this to 10,000 requests/minute?"**

**What they're testing:** Understanding of rate limits, retry storms, queuing theory, cost explosions.

**Strong answer:**
- **Rate limits hit immediately.** GPT-4o Tier 1 = 3,000 RPM. You need Tier 5 or enterprise agreement.
- **Thundering herd on retries.** If provider has a hiccup at 10K RPM, all clients retry simultaneously. Without jitter, you create a synchronized flood that worsens the outage.
- **TPM is the real bottleneck.** 10K req/min × 3K tokens = 30M TPM. Even enterprise tiers may cap at 10-20M TPM.
- **Async queue + worker pool** becomes necessary: decouple ingestion rate from LLM call rate using a message queue (Redis/SQS), multiple async workers pulling from the queue, each respecting rate limits.
- **Cost at scale:** 10K req/min × 60 min × $0.028/req = $16,800/day. Cost engineering becomes critical.
- **Latency degradation:** At high volume, provider infrastructure queuing adds latency. p99 may blow out even with async design.

**Solution sketch:**
```
Clients → API Gateway → Redis Queue → LLM Worker Pool (rate-limited)
                                           ↓
                                      LLM Provider API
```

---

### Question 3
**"A user reports that your LLM-powered feature returns different answers to the same question every time. How do you debug and fix this?"**

**What they're testing:** Temperature understanding, caching, determinism, observability.

**Step-by-step debug:**

1. **Check temperature setting.** Is `temperature > 0`? Even 0.1 causes noticeable variation at high request volume. For deterministic tasks, set `temperature=0`.
2. **Check if caching is enabled.** If cache is bypassed or keying is wrong (e.g., timestamps in the key), you're calling the API fresh each time.
3. **Check if prompt is stable.** Is there dynamic content in the system prompt that changes per call? Date/time injection, user-specific context?
4. **Check model version.** Did the provider update the model? `gpt-4o` without a version pin may change behavior with model updates. Pin to `gpt-4o-2024-05-13` explicitly.
5. **Is it semantic variation or factual variation?** Semantically equivalent but differently phrased answers are acceptable. Factually different answers (different city names, different numbers) are a quality problem.

**Fix:**
```python
# Pin model version
model="gpt-4o-2024-05-13"  # not "gpt-4o"

# Set temperature to 0 for deterministic tasks
temperature=0

# Enable response caching
use_cache=True
```

---

### Question 4
**"Your LLM API costs are $8,000/month. Your CTO asks for a 50% reduction without degrading user experience. Walk me through your approach."**

**What they're testing:** Systematic cost analysis, model selection, caching strategy, architecture changes.

**Structured approach:**

**Step 1: Instrument and measure first**
- Log every call: model, input_tokens, output_tokens, latency, endpoint
- Calculate cost per call type (classification calls vs. generation calls vs. embedding calls)
- Identify which call types drive 80% of cost (Pareto principle)

**Step 2: Quick wins (< 1 week)**
- Enable prompt caching on all static system prompts (~30-40% cost reduction on input tokens)
- Add Redis response cache for temperature=0 calls (cache hit rate often 40-60% for common queries)
- Set `max_tokens` appropriately on every call

**Step 3: Model routing (highest impact)**
- Audit which tasks genuinely need GPT-4o vs. gpt-4o-mini
- Simple classification/extraction → gpt-4o-mini (17x cheaper)
- Build an eval harness: test gpt-4o-mini quality vs. gpt-4o on your actual data
- Route 60-80% of tasks to cheaper model

**Step 4: Async batch processing**
- Non-real-time tasks (analytics, nightly processing, bulk operations) → Batch API (50% off)

**Step 5: Prompt optimization**
- Audit longest prompts — often have redundant instructions
- Move context retrieval to smaller/cheaper embedding model
- Reduce retrieved context window where precision > recall

**Expected outcome:**
```
Prompt caching:   -35% on input token cost
Response caching: -40% on total calls
Model routing:    -60% on gpt-4o calls → to gpt-4o-mini
Combined effect:  easily achieves 50%+ reduction
```

---

### Quick-Fire Concepts

**Q: What is the difference between streaming and non-streaming in terms of total latency?**
A: Zero difference in total generation time. Streaming only reduces time-to-first-token (perceived latency). The model generates the same number of tokens either way.

**Q: Why do output tokens cost more than input tokens?**
A: Input tokens are processed in parallel during the prefill phase. Output tokens require sequential forward passes — one full transformer inference per token. More compute = higher cost.

**Q: Why should you never cache responses at temperature > 0?**
A: Temperature > 0 means the model's output is sampled stochastically. The same prompt will produce different outputs on each call. Caching one of those outputs means all subsequent callers get one specific random sample rather than their own fresh generation.

**Q: What's the thundering herd problem in retry logic?**
A: If all clients retry simultaneously after a provider error, the synchronized flood of requests hits the API at the same instant, potentially making the outage worse. Jitter (random delay) spreads retry attempts across time to prevent synchronized storms.

**Q: What's the difference between the Batch API and standard async calls?**
A: Standard async calls are real-time: you get a response in seconds. The Batch API accepts a file of up to 50K requests, processes them within 24 hours, and charges 50% less. Use Batch for offline/non-time-sensitive workloads only.

---

### System Design Traps

**Trap 1:** "I'll just use `asyncio.gather()` on all my requests."
→ Without a semaphore, you fire all requests simultaneously. 1,000 concurrent calls = instant rate limit breach.

**Trap 2:** "I'll cache with the full message array as key."
→ If the system prompt has a timestamp or user ID in it, every call is a cache miss. The cache key must match the actual prompt structure.

**Trap 3:** "I don't need retry logic — the provider is reliable."
→ Even 99.9% uptime = 8.7 hours of downtime/year. Any production system hitting LLM APIs needs retry logic.

**Trap 4:** "I'll use the model's context window as conversation memory."
→ At 128K tokens, a long conversation hits the limit after thousands of turns — but more importantly, every token in context costs money on every call. Long contexts compound cost rapidly.
