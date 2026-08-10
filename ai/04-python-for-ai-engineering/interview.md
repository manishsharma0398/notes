# Chapter 4 — Interview Questions
## Python for AI Engineering: Pydantic, Async, FastAPI

---

## Q1: Design Question — How would you architect a production AI API that serves 10,000 requests/day?

**What the interviewer is really asking:**
Can you translate "use async Python" into actual architectural decisions with tradeoffs?

**Strong answer structure:**

```
Layer 1: FastAPI with async endpoints
  - AsyncOpenAI client, singleton via @lru_cache + Depends()
  - All LLM calls: await client.chat.completions.create(...)
  - Concurrency budget: asyncio.Semaphore(N) where N = RPM_limit / (60 / avg_latency)

Layer 2: Response caching (Redis)
  - Cache at temperature=0 only (deterministic output)
  - Key: SHA256(model + messages)
  - Saves 40-60% of LLM calls for FAQ-style traffic

Layer 3: Pydantic throughout
  - Request validation: FastAPI auto-validates, returns 422 on bad input
  - LLM output validation: parse + ValidationError handling, retry on failure
  - Settings: BaseSettings validates env vars at startup

Layer 4: Observability
  - Log: model, input_tokens, output_tokens, latency_ms, cache_hit per request
  - Alert on: p95 latency >10s, 429 rate >5%, ValidationError rate >1%

At 10K req/day = ~7 req/min average, likely bursting to 30-50 req/min during peak.
This is well within OpenAI's limits with semaphore(10) and Redis caching.
```

**Follow-up trap:** "What breaks at 1M requests/day?"
- Single FastAPI process: hits CPU limits → need multiple workers (uvicorn --workers N)
- In-process semaphore: doesn't coordinate across workers → rate limiting breaks
- Fix: move rate limit coordination to Redis (sliding window counter)
- LLM cost: at $0.15/1M tokens and ~500 tokens/request = $75/day → need batching or caching

---

## Q2: System Design Trap — A teammate says "just use `async def` everywhere and it'll be fast"

**What's wrong with this statement?**

`async def` alone does nothing. The performance comes from `await`-ing genuinely
non-blocking I/O operations. Three traps:

**Trap 1: Sync I/O inside async function**
```python
async def handler():
    # STILL blocks the event loop — async def didn't help
    content = open("large_file.txt").read()  # Sync blocking I/O
    result = requests.get("http://api.example.com")  # Sync HTTP
```

**Trap 2: CPU-bound work in async function**
```python
async def handler():
    # CPU work doesn't yield to the event loop — blocks everything
    result = process_large_pdf(content)  # Runs for 5 seconds, blocking
```
Fix: `await loop.run_in_executor(executor, process_large_pdf, content)`

**Trap 3: Sequential awaits**
```python
async def handler():
    r1 = await call_llm(prompt1)  # Sequential — doesn't overlap
    r2 = await call_llm(prompt2)  # Waits for r1 to finish first
```
Fix: `r1, r2 = await asyncio.gather(call_llm(prompt1), call_llm(prompt2))`

**The rule:**
> `async def` + `await` on non-blocking I/O = concurrent.
> `async def` + blocking code = false security with no benefit.

---

## Q3: Deep Dive — What's the difference between `json.JSONDecodeError` and `pydantic.ValidationError` in LLM output parsing, and why does it matter in production?

**Answer:**

These errors have different root causes and require different production responses.

```
json.JSONDecodeError
  Root cause: Model output is NOT valid JSON at all
  Example: LLM returned "Here is the JSON: {name: Alice}" (missing quotes)
  Cause: Weak prompt, model ignoring instructions, high temperature
  Fix: Stronger prompt, lower temperature, retry, different model

ValidationError
  Root cause: JSON is valid, but data doesn't match your Pydantic schema
  Example: {"name": "Alice", "age": "twenty-five"}  (age is string not int)
  Cause: Model hallucinated field values, schema changed after deployment
  Fix: Schema revision, prompt with example, stricter output instructions
```

**Why logging them separately matters:**

If you lump them into one catch block and log "LLM output error", you can't tell
whether your JSON parsing instruction is failing (engineering fix) vs. your schema
is wrong (schema fix). Different alert channels, different on-call responses.

```python
try:
    data = json.loads(raw)
    result = MyModel(**data)
except json.JSONDecodeError as e:
    metrics.increment("llm.json_parse_error")  # Alerts on-call if rate spikes
    logger.error("LLM produced non-JSON", extra={"raw": raw[:200]})
    raise
except ValidationError as e:
    metrics.increment("llm.schema_mismatch")   # Different alert threshold
    logger.error("LLM schema mismatch", extra={"errors": e.errors()})
    raise
```

---

## Q4: Practical — What's wrong with this FastAPI endpoint?

```python
@app.post("/analyze")
async def analyze(text: str):
    client = OpenAI()  # ← ?
    response = client.chat.completions.create(  # ← ?
        model="gpt-4o",
        messages=[{"role": "user", "content": text}],
    )
    return {"result": response.choices[0].message.content}
```

**Three problems:**

1. **`OpenAI()` (sync client)**: `client.chat.completions.create()` is synchronous.
   Called inside `async def`, it blocks the event loop for the entire duration of the
   LLM call. All other requests to this server stall.

2. **Client created per request**: `OpenAI()` creates a new HTTP connection pool on
   every request. At scale this causes connection exhaustion and significant overhead.
   Should be a singleton via `@lru_cache + Depends()`.

3. **No `response_model`**: FastAPI serializes the entire return dict with no type
   checking. If `response.choices[0].message.content` is `None` (API error), the
   endpoint returns `{"result": null}` silently instead of raising a proper error.

**Fixed version:**
```python
@lru_cache
def get_client() -> AsyncOpenAI:
    return AsyncOpenAI()

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    request: AnalysisRequest,
    client: AsyncOpenAI = Depends(get_client),
):
    response = await client.chat.completions.create(...)
    return AnalysisResponse(result=response.choices[0].message.content)
```

---

## Q5: Why Does Pydantic `BaseSettings` Validate at Startup vs. First Use?

**The question they're really asking:**
Do you understand fail-fast design and where in the request lifecycle errors should surface?

**Answer:**

`BaseSettings()` is instantiated at module import time (or at the top of the app).
This means if `OPENAI_API_KEY` is missing or `MAX_TOKENS` can't be coerced to int,
you find out when the process starts — not when the first user request hits an
invalid configuration and causes an unhandled exception at 2am.

```python
# Module level — fails at startup
settings = AISettings()  # ValidationError here = process won't start

# Per-request — fails silently in production
@app.post("/chat")
async def chat(text: str):
    key = os.getenv("OPENAI_API_KEY")  # None at runtime, 401 error per request
```

**Fail-fast is a reliability pattern:**
- CI/CD catches missing env vars before deployment
- Health checks fail cleanly on startup
- Error is visible in deployment logs, not buried in per-request traces

---

## Q6: Gotcha — Why Can't You Call `asyncio.run()` Inside a FastAPI Route?

```python
@app.post("/bad")
async def bad_endpoint():
    result = asyncio.run(some_coroutine())  # RuntimeError!
```

**Answer:**

`asyncio.run()` creates a **new event loop** and runs the coroutine to completion.
FastAPI's ASGI server (uvicorn) already runs an event loop for the entire lifetime
of the process. You can't nest event loops.

`RuntimeError: This event loop is already running.`

**The correct pattern:** Just `await` the coroutine directly:
```python
@app.post("/correct")
async def correct_endpoint():
    result = await some_coroutine()  # Works — same event loop
```

**Where this bites you:** Jupyter notebooks also run an event loop. Code that works
in a script with `asyncio.run()` breaks in notebooks. Fix: `nest_asyncio.apply()`
or use `await` directly in notebook cells.

---

## Q7: Clarification — What's the difference between `pydantic` and `pydantic-ai`?

**Why this is an interview trap:**
Candidates who answer "pydantic supports Anthropic and Google" without clarifying which
library they mean will confuse interviewers and reveal shallow understanding.

**The precise answer:**

```
pydantic (pip install pydantic)
  ↓
  Runtime type validation library.
  BaseModel, ValidationError, Field, BaseSettings.
  Has NO concept of LLMs, agents, or model providers.
  Works standalone — zero AI dependencies.

pydantic-ai (pip install pydantic-ai)
  ↓
  A separate agentic AI *framework*, built on top of pydantic.
  Provides: Agent class, tool use, message history, model-agnostic interface.
  Supports: OpenAI, Anthropic, Google (Gemini + Vertex AI), xAI, Groq, Mistral,
            Ollama, HuggingFace, Cohere, Bedrock, and more.
```

**Code contrast:**
```python
# pydantic (just validation — no AI)
from pydantic import BaseModel
class Output(BaseModel):
    answer: str

# pydantic-ai (AI framework — uses pydantic internally)
from pydantic_ai import Agent
from pydantic import BaseModel  # Still need pydantic for the schema

class Output(BaseModel):
    answer: str

agent = Agent('anthropic:claude-sonnet-4-5', result_type=Output)
result = await agent.run("What is 2+2?")
output: Output = result.data  # Validated Output instance
```

**Multi-provider support in pydantic-ai:**
```python
# Same code, swap provider by changing one string:
Agent('openai:gpt-4o-mini',            result_type=Output)
Agent('anthropic:claude-sonnet-4-5',   result_type=Output)
Agent('google:gemini-2.0-flash',       result_type=Output)  # Gemini API
Agent('google-cloud:gemini-2.0-flash', result_type=Output)  # Vertex AI
```

**When to use which:**
```
pydantic alone:
  → Parsing + validating raw LLM output (raw SDK approach)
  → Config validation (BaseSettings)
  → Tool schemas for function calling

pydantic-ai:
  → Multi-provider system where you want to switch models easily
  → Agent-based architectures (tools, memory, retries built-in)
  → Prototyping across providers without vendor lock-in
```

---

## Interview Traps Summary

| Trap | What Interviewers Expect |
|------|--------------------------|
| "async def makes code concurrent" | No — you need `await` on non-blocking I/O. CPU work still blocks. |
| "Pydantic validates at the type hint level" | No — runtime enforcement at instantiation, not static analysis |
| "StreamingResponse just sends faster" | Streaming reduces time-to-first-token, not total generation time |
| "BackgroundTasks is production-ready for queuing" | Only for loss-tolerant, low-volume work. Celery for anything durable. |
| "`asyncio.gather()` handles failures gracefully" | Only with `return_exceptions=True` — otherwise one failure kills all |
| "OpenAI client can be shared across threads" | AsyncOpenAI client is not thread-safe across multiple event loops |
| "`pydantic` supports Anthropic/Google" | No — `pydantic` is just validation. `pydantic-ai` is the AI framework. |

---

## System Design Sketch: Batch AI Processing Service

```
10,000 documents to analyze overnight

Client
  ↓ POST /batch (document_urls[])
  ↓ 202 Accepted + batch_id

ARQ/Celery Worker Pool
  ├── Worker 1: Semaphore(5) → process docs 0-2000
  ├── Worker 2: Semaphore(5) → process docs 2000-4000
  └── Worker 3: Semaphore(5) → process docs 4000-6000

Each worker:
  1. Download document (async httpx)
  2. Chunk text
  3. Call AsyncOpenAI with Semaphore(5) concurrency
  4. Parse with Pydantic
  5. Write to database
  6. Update job progress in Redis

Client polls: GET /batch/{batch_id}/status
  → {processed: 4532, total: 10000, errors: 12, eta_minutes: 45}
```

**Why not use OpenAI Batch API instead?**
OpenAI Batch API is 50% cheaper but returns results within 24 hours — no streaming,
no progress visibility. Use it for cost-sensitive offline workloads where latency
doesn't matter. Use async workers for real-time progress and SLA guarantees.
