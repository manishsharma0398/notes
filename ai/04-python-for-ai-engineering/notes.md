# Chapter 4 — Revision Notes
## Python for AI Engineering: Senior Engineer's Cheat Sheet

---

### The Three Core Problems Python Solves for AI

```
Problem 1: LLMs return untyped strings
  Solution: Pydantic — typed parsing + validation contract

Problem 2: LLM calls are slow I/O (2-15s each)
  Solution: async/await — concurrent non-blocking execution

Problem 3: AI services are stateful, streaming, long-running
  Solution: FastAPI — async-first, SSE, DI, typed routing
```

---

### Pydantic Quick Reference

#### The Parsing Pipeline (Always)
```
LLM raw string
  → strip_markdown_fences()   [```json ... ``` removal]
  → json.loads()              [JSONDecodeError if invalid JSON]
  → MyModel(**data)           [ValidationError if schema mismatch]
  → typed Python object       [safe to use]
```

#### Two Distinct Errors — Log Them Separately
| Error | Cause | Fix |
|-------|-------|-----|
| `json.JSONDecodeError` | Model didn't produce JSON | Improve prompt, add retry |
| `ValidationError` | JSON valid but schema wrong | Fix schema or prompt |

#### Three Approaches to Structured Output
| Approach | Works With | Parsing Code | Notes |
|----------|-----------|-------------|-------|
| Prompt + Pydantic | Any model | Required (strip fences + json.loads) | Most portable |
| OpenAI `beta.chat.completions.parse()` | OpenAI gpt-4o+ only | None | Constrained decoding |
| `pydantic-ai` Agent framework | OpenAI, Anthropic, Google, many more | None | Model-agnostic abstraction |

**Rule: Use Approach 1 for raw SDK work; use `pydantic-ai` if you need a multi-model system.**

---

### ⚠️ pydantic vs pydantic-ai — They Are Different Libraries

```
pydantic         → Runtime type validation library (BaseModel, ValidationError, Field)
                   pip install pydantic

pydantic-ai      → Agentic AI framework built ON TOP of pydantic
                   Provides Agent, tool use, multi-model support
                   pip install pydantic-ai
```

**Never confuse them.** `pydantic-ai` uses `pydantic` internally for schema validation,
but it is a completely separate project and install.

#### Pydantic AI — Model Strings
```python
from pydantic_ai import Agent
from pydantic import BaseModel

class Output(BaseModel):
    answer: str
    confidence: float

# Switch providers by changing ONE string:
agent = Agent('openai:gpt-4o-mini',           result_type=Output)
agent = Agent('anthropic:claude-sonnet-4-5',  result_type=Output)
agent = Agent('google:gemini-2.0-flash',      result_type=Output)
agent = Agent('google-cloud:gemini-2.0-flash',result_type=Output)  # Vertex AI

result = await agent.run("Your question here")
output: Output = result.data  # Already validated Pydantic model
```

#### Pydantic AI — Auth env vars per provider
```
OPENAI_API_KEY       → openai: prefix
ANTHROPIC_API_KEY    → anthropic: prefix
GOOGLE_API_KEY       → google: prefix (Gemini API / AI Studio)
gcloud auth          → google-cloud: prefix (Application Default Credentials)
```

#### Pydantic AI — When to Use vs Raw SDK
```
Raw SDK (AsyncOpenAI, AsyncAnthropic):
  ✅ Full control over API params
  ✅ Single-provider system
  ✅ Streaming pipelines
  ✅ Less abstraction overhead

pydantic-ai:
  ✅ Multi-model system (switch OpenAI ↔ Claude ↔ Gemini by config)
  ✅ Built-in structured output for all providers
  ✅ Agent patterns: tool use, retries, message history
  ⚠️ Less control over provider-specific params
  ⚠️ Adds another dependency
```

#### `field_validator` for Cross-Field Logic
```python
@field_validator("total_found")
@classmethod
def validate_count(cls, v, info):
    if "entities" in info.data and v != len(info.data["entities"]):
        raise ValueError("total_found doesn't match entities list")
    return v
```

#### `BaseSettings` — Fail at Startup, Not at Runtime
```python
from pydantic_settings import BaseSettings

class AISettings(BaseSettings):
    openai_api_key: str      # Required — crashes at startup if missing
    model_name: str = "gpt-4o-mini"
    temperature: float = 0.0
    model_config = {"env_file": ".env"}
```

---

### Async/Await Quick Reference

#### The One Comparison That Matters
```
Sequential:  total_time = sum(all latencies)   → 5 calls × 3s = 15s
Concurrent:  total_time = max(all latencies)   → 5 calls × 3s = ~3s

asyncio.gather(call1(), call2(), call3())  # Starts all simultaneously
```

#### Bounded Concurrency (Always Use in Production)
```python
semaphore = asyncio.Semaphore(10)  # Max 10 concurrent LLM calls

async def process(item):
    async with semaphore:
        return await client.chat.completions.create(...)

results = await asyncio.gather(*[process(i) for i in items])
```

**How to size the semaphore:**
```
max_concurrent ≈ RPM_limit / (60 / avg_call_duration_seconds)
Example: 60 RPM, 3s avg → 60 / (60/3) = 60 / 20 = 3 req/s → 10 concurrent
```

#### gather() with Error Resilience
```python
# BAD: first exception propagates, other results lost
results = await asyncio.gather(*tasks)

# GOOD: all tasks complete, exceptions returned as values
results = await asyncio.gather(*tasks, return_exceptions=True)
for r in results:
    if isinstance(r, Exception):
        logger.error(f"Task failed: {r}")
```

#### Blocking I/O in Async Context
```python
# WRONG — blocks the event loop
response = requests.get(url)  # Sync HTTP inside async function

# CORRECT — offload to thread pool
loop = asyncio.get_event_loop()
response = await loop.run_in_executor(None, requests.get, url)
```

#### Client Selection
```python
# WRONG — sync client, blocks event loop
from openai import OpenAI
client = OpenAI()

# CORRECT — async client
from openai import AsyncOpenAI
client = AsyncOpenAI()
response = await client.chat.completions.create(...)
```

---

### FastAPI Quick Reference

#### Endpoint Anatomy
```python
@app.post("/route", response_model=ResponseModel)
async def handler(
    request: RequestModel,                   # Auto-validated from JSON body
    client: AsyncOpenAI = Depends(get_ai),   # Injected dependency
) -> ResponseModel:
    ...
```

#### The Five Patterns
```
1. Typed endpoint    → response_model controls serialization
2. Streaming (SSE)  → StreamingResponse + async generator
3. Background task  → BackgroundTasks.add_task() + job polling
4. DI client        → @lru_cache function + Depends()
5. Lifespan         → asynccontextmanager → yield → cleanup
```

#### Streaming Endpoint — Critical Headers
```python
return StreamingResponse(
    generator(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # MUST HAVE — prevents Nginx buffering
    }
)
```

#### SSE Format
```
data: Hello\n\n
data:  world\n\n
data: [DONE]\n\n
```

#### BackgroundTasks vs Celery
| Factor | BackgroundTasks | Celery + Redis |
|--------|----------------|----------------|
| Job survives restart | ❌ No | ✅ Yes |
| Horizontal scale | ❌ No | ✅ Yes |
| Retry on failure | ❌ No | ✅ Yes |
| Setup complexity | Low | High |
| Use for | Webhooks, logging | Production AI pipelines |

#### Dependency Injection Pattern
```python
@lru_cache
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI()  # One instance, shared across all requests

@app.post("/chat")
async def chat(client: AsyncOpenAI = Depends(get_openai_client)):
    ...
```

---

### Common Mistakes Cheat Sheet

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Sync client in async code | Event loop blocked, all requests stall | Use `AsyncOpenAI` |
| Client created per request | Slow, connection pool thrashing | Use `@lru_cache` DI |
| `gather()` without `return_exceptions` | One failure drops all results | Add `return_exceptions=True` |
| No `ValidationError` handling | 500 crash on malformed LLM output | Wrap in try/except |
| Missing `X-Accel-Buffering` header | Streaming appears broken behind Nginx | Add the header |
| No `max_tokens` set | Runaway output, unpredictable cost | Always set `max_tokens` |
| Blocking I/O in async handler | Event loop freeze | Use `run_in_executor` |

---

### Production Architecture Reminder

```
HTTP Request
    ↓
FastAPI (async)
    ↓ Pydantic validates input
    ↓ Dependency injects AsyncOpenAI client
    ↓
async def handler()
    ↓ await AsyncOpenAI call (non-blocking)
    ↓ Pydantic validates LLM output
    ↓ ValidationError? → log + 502
    ↓
FastAPI serializes response_model
    ↓
HTTP Response
```

---

### The Three Questions to Ask Before Writing Any AI Endpoint

1. **Do I need a response immediately?**
   - Yes → sync endpoint (but async internally)
   - No → background task + job ID

2. **Is the response a stream or a complete response?**
   - Stream → `StreamingResponse` + SSE generator
   - Complete → regular `response_model`

3. **Will I call this with many inputs at once?**
   - Yes → `asyncio.gather()` + `Semaphore` bounded concurrency
   - No → single `await` call
