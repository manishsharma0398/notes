# Chapter 4 — Python for AI Engineering
## Pydantic, Async/Await, and FastAPI — AI-Specific Patterns

---

## The Mental Model

You already know Python syntax. What you don't yet know is how Python's ecosystem
**behaves differently** when you add LLM calls into the picture.

Three things change everything:

1. **Every LLM call is an I/O operation** — slow (2–15 seconds), unreliable, expensive.
   This means async isn't optional; it's the difference between a system that scales
   and one that hangs.

2. **LLM outputs are untyped strings** — The model returns text. Your application needs
   structured data. Pydantic is the engineering bridge between "LLM said something" and
   "my system can act on it safely."

3. **Your AI service is a stateful, streaming, long-running HTTP endpoint** — Not a
   simple JSON REST endpoint. FastAPI's async model, background tasks, and SSE support
   are exactly shaped for this.

These are not convenience tools. They are **structural requirements** for production AI systems.

---

## Part 1: Pydantic — Typed Contracts with LLMs

### Why Pydantic is the Most Important Library in AI Engineering

When an LLM produces output, it returns a raw string. That string might be:
- Valid JSON
- JSON with trailing commas (technically invalid)
- JSON wrapped in markdown code fences (```json ... ```)
- Partially valid JSON (model stopped mid-output)
- English text with JSON embedded somewhere
- Complete hallucinated nonsense

Your code cannot call `.get("name")` on a string. You need a **structured parsing
and validation layer** between the LLM and the rest of your system. Pydantic is that layer.

### What Pydantic Actually Does

Pydantic is a **runtime type enforcement library**, not just a type hint checker.

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional

class ExtractedPerson(BaseModel):
    name: str
    age: int
    email: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
```

When you call `ExtractedPerson(**data)`:
1. It coerces types (`"42"` → `42`)
2. Validates constraints (`Field(ge=0.0, le=1.0)`)
3. Raises a structured `ValidationError` if anything fails — not a generic exception

The `ValidationError` tells you **which field failed and why** — critical for debugging
LLM extraction failures in production.

### The LLM Output Pipeline

```
LLM Response (raw string)
        │
        ▼
  Strip markdown fences (```json ... ```)
        │
        ▼
  json.loads() → dict
        │
        ▼
  Pydantic model validation
        │
        ├── Success → typed Python object, safe to use
        └── ValidationError → log + retry or fallback
```

The stripping step is non-trivial. GPT-4, Claude, Gemini — all of them sometimes wrap
JSON in markdown fences even when you tell them not to. Always handle this in production.

### Structured Output: Two Approaches

#### Approach 1: Prompt Engineering + Pydantic Parsing (Works with any model)

You instruct the model to produce JSON, then parse and validate.

```python
import json
import re
from pydantic import BaseModel, ValidationError

class SentimentResult(BaseModel):
    sentiment: str  # "positive" | "negative" | "neutral"
    score: float    # 0.0 to 1.0
    reasoning: str

def extract_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from LLM output."""
    # Handle ```json ... ``` and ``` ... ```
    pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    match = re.search(pattern, text)
    if match:
        text = match.group(1)
    return json.loads(text.strip())

def parse_llm_output(raw_text: str) -> SentimentResult:
    try:
        data = extract_json(raw_text)
        return SentimentResult(**data)
    except (json.JSONDecodeError, ValidationError) as e:
        raise ValueError(f"LLM output parsing failed: {e}\nRaw output: {raw_text}")
```

**Production pitfall:** `json.JSONDecodeError` and `ValidationError` are different errors.
`json.JSONDecodeError` means the model didn't produce valid JSON at all. `ValidationError`
means the JSON was valid but the data didn't match your schema. Log them differently —
they have different causes and different fixes.

#### Approach 2: OpenAI Structured Outputs (Model-enforced schema)

OpenAI's API supports passing a JSON Schema to constrain model output at the
**token-sampling level** (constrained decoding — covered in Chapter 1).

```python
from openai import AsyncOpenAI
from pydantic import BaseModel

client = AsyncOpenAI()

class SentimentResult(BaseModel):
    sentiment: str
    score: float
    reasoning: str

async def analyze_sentiment(text: str) -> SentimentResult:
    response = await client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",  # Structured outputs require this model or newer
        messages=[
            {"role": "system", "content": "Analyze the sentiment of the given text."},
            {"role": "user", "content": text}
        ],
        response_format=SentimentResult,  # Pydantic model passed directly
    )
    return response.choices[0].message.parsed  # Already a SentimentResult instance
```

**What's happening under the hood:** OpenAI converts your Pydantic model to JSON Schema,
sends it to the API, and the model uses constrained decoding to ensure its output is
always valid JSON matching that schema. The `.parsed` attribute gives you a typed Python
object with no parsing code on your side.

**Engineering tradeoff:**
- Structured outputs: Zero parsing failures, but only works with certain OpenAI models,
  and you lose flexibility (can't use Claude, Gemini, or local models without switching approach).
- Prompt + Pydantic: Works with any model, but you must handle malformed output.

**For production systems serving multiple models:** Use Approach 1 (prompt + Pydantic)
or Approach 3 below (Pydantic AI framework) for true model portability.

#### Approach 3: Pydantic AI Framework (Multi-Model, Model-Agnostic)

> ⚠️ **Important distinction:** `pydantic-ai` is a **separate library** from `pydantic`.
> `pydantic` = runtime type validation. `pydantic-ai` = an agentic AI framework
> that uses Pydantic for structured outputs and supports multiple LLM providers.

Install:
```bash
pip install pydantic-ai
# Or with specific provider:
pip install "pydantic-ai-slim[anthropic]"
pip install "pydantic-ai-slim[google]"
```

Pydantic AI wraps OpenAI, Anthropic, and Google under a unified interface.
You switch models by changing a string — your structured output code stays identical.

```python
from pydantic_ai import Agent
from pydantic import BaseModel

class SentimentResult(BaseModel):
    sentiment: str
    score: float
    reasoning: str

# ── OpenAI ──────────────────────────────────────────────────────────────
agent_openai = Agent(
    'openai:gpt-4o-mini',
    result_type=SentimentResult,
)

# ── Anthropic (Claude) ──────────────────────────────────────────────────
agent_claude = Agent(
    'anthropic:claude-sonnet-4-5',         # ANTHROPIC_API_KEY env var
    result_type=SentimentResult,
)

# ── Google (Gemini via Gemini API) ──────────────────────────────────────
agent_gemini = Agent(
    'google:gemini-2.0-flash',             # GOOGLE_API_KEY env var
    result_type=SentimentResult,
)

# ── Google Cloud / Vertex AI ────────────────────────────────────────────
agent_vertex = Agent(
    'google-cloud:gemini-2.0-flash',       # Uses Application Default Credentials
    result_type=SentimentResult,
)

async def analyze(text: str) -> SentimentResult:
    result = await agent_openai.run(text)  # Swap agent to switch model
    return result.data                     # Already validated SentimentResult
```

**What Pydantic AI does under the hood:**
1. Converts `result_type=SentimentResult` to the appropriate structured output format
   for the chosen provider (JSON schema for OpenAI/Anthropic/Google)
2. Calls the model's API (using the provider's native async client)
3. Validates the response against the Pydantic schema
4. Returns a typed `result.data` object — you never touch raw JSON

**Model strings follow `provider:model-name` format:**
```
openai:gpt-4o-mini
anthropic:claude-opus-4-5
anthropic:claude-sonnet-4-5
google:gemini-2.0-flash
google:gemini-2.5-pro-preview
google-cloud:gemini-2.0-flash    # Vertex AI / Google Cloud
```

**Authentication — each provider reads its own env var:**
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...       # For google: prefix (Gemini API / AI Studio)
# google-cloud: uses Application Default Credentials (gcloud auth)
```

**Engineering tradeoff vs. raw provider clients:**
- ✅ Single abstraction layer: same code works across OpenAI, Claude, Gemini
- ✅ Automatic structured output validation (no parsing code needed)
- ✅ Agent patterns built-in: tool use, retries, message history
- ⚠️ Less control: can't use provider-specific parameters easily
- ⚠️ Extra dependency: adds `pydantic-ai` to your stack
- ⚠️ Newer library: less battle-tested than `openai` or `anthropic` SDK directly

**When to use Pydantic AI vs. raw SDK:**
```
Raw SDK (AsyncOpenAI, AsyncAnthropic):  You need full control over API params,
                                         single-provider system, streaming pipelines

Pydantic AI:                             Multi-model system, structured outputs,
                                         agent patterns (tools, memory, retries)
```

### Pydantic for Configuration and Settings

This is equally important but often missed. Your AI system has many moving parameters:
model names, temperature, max_tokens, API keys, retry limits. Pydantic's `BaseSettings`
enforces types on environment variables at startup — not at first use.

```python
from pydantic_settings import BaseSettings
from typing import Optional

class AISettings(BaseSettings):
    openai_api_key: str                  # Required — fails at startup if missing
    model_name: str = "gpt-4o-mini"
    max_tokens: int = 1024
    temperature: float = 0.0
    max_retries: int = 3
    request_timeout: float = 30.0
    redis_url: Optional[str] = None      # Optional — cache disabled if not provided

    model_config = {"env_file": ".env"}

settings = AISettings()  # Fails loudly at startup, not at 2am during a user request
```

**Why this matters:** Configuration errors in AI services tend to be silent.
The wrong model name causes a 404 at runtime. An int parsed from an env variable
as a string causes a type error deep in your retry logic. `BaseSettings` surfaces
all of this at process startup, not buried in a production error trace.

### Pydantic for Tool/Function Schemas

When building AI agents (Chapter 9), you define "tools" the LLM can call.
The tool's input schema must be a JSON Schema. Pydantic generates this automatically.

```python
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    """Search the web for current information."""
    query: str = Field(description="The search query to execute")
    max_results: int = Field(default=5, ge=1, le=20, description="Number of results to return")

# Generate JSON Schema for the LLM's function_call definition
schema = SearchInput.model_json_schema()
```

This schema is what you pass to the OpenAI `tools` parameter. Pydantic keeps your
Python type definitions and your LLM tool schema in sync automatically — you don't
maintain two separate definitions.

---

## Part 2: Async/Await — Why It's Mandatory for AI Services

### The Problem async Solves (Specifically for LLMs)

A typical LLM call takes **2–15 seconds**. During that time, the model's API server is
doing GPU computation. Your process is waiting. If you're using synchronous Python:

```
Thread 1: ──[req]──[WAITING 8 seconds]──[resp]──
Thread 2: ──────────────[req]──[WAITING 8 seconds]──[resp]──
Thread 3: ──────────────────────[req]──[WAITING 8 seconds]──[resp]──
```

In synchronous Python web servers (Flask with default WSGI), each request occupies a
thread while waiting. 10 concurrent users = 10 threads blocked for 8 seconds each.
You need thread pools sized to handle this — expensive and doesn't scale.

With async:

```
Event Loop:
  t=0:    [req1 sent] → yield control
  t=0:    [req2 sent] → yield control
  t=0:    [req3 sent] → yield control
  t=2.1:  [req2 response] → process → respond
  t=7.8:  [req1 response] → process → respond
  t=8.3:  [req3 response] → process → respond
```

One thread handles all three requests. The I/O wait time overlaps. This is not just
a performance optimization — it's the **correct architecture** for I/O-bound workloads.

### The Async Mental Model: Coroutines, the Event Loop, and await

A coroutine is a function that can **suspend itself and hand control back to the
event loop** while waiting for I/O. The `await` keyword is the suspension point.

```python
import asyncio
import time

# Simulating LLM calls with sleep
async def call_llm(prompt: str, delay: float) -> str:
    print(f"  → Sending: '{prompt}'")
    await asyncio.sleep(delay)  # Yields control; other coroutines run here
    print(f"  ← Received response for: '{prompt}'")
    return f"Response to {prompt}"

async def main():
    start = time.perf_counter()

    # Sequential — wasteful
    r1 = await call_llm("What is Python?", 2.0)
    r2 = await call_llm("What is async?", 1.5)

    sequential_time = time.perf_counter() - start
    print(f"Sequential: {sequential_time:.2f}s")  # ~3.5s

    start = time.perf_counter()

    # Concurrent — correct
    r1, r2 = await asyncio.gather(
        call_llm("What is Python?", 2.0),
        call_llm("What is async?", 1.5),
    )

    concurrent_time = time.perf_counter() - start
    print(f"Concurrent: {concurrent_time:.2f}s")  # ~2.0s

asyncio.run(main())
```

**Key insight:** `asyncio.gather()` starts all coroutines and interleaves their I/O
waits. The total time is `max(individual times)`, not `sum(individual times)`.
For 10 LLM calls averaging 3s each: sequential = 30s, concurrent = ~3s.

### Production Pattern: Bounded Concurrency with Semaphore

`asyncio.gather()` with no limit will send ALL requests simultaneously. If you have
1,000 items to process and call `gather(*[process(item) for item in items])`, you'll
hammer the API with 1,000 concurrent requests and get rate-limited.

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def process_item(semaphore: asyncio.Semaphore, item: str) -> str:
    async with semaphore:  # Only N tasks can be inside this block at once
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": item}],
            max_tokens=256,
        )
        return response.choices[0].message.content

async def process_batch(items: list[str], max_concurrent: int = 10) -> list[str]:
    semaphore = asyncio.Semaphore(max_concurrent)
    tasks = [process_item(semaphore, item) for item in items]
    return await asyncio.gather(*tasks)
```

**How to choose `max_concurrent`:**
1. Check your rate limit: if you're at 60 RPM and calls take ~3s, max safe concurrency
   is 60/20 = 3 requests per second → ~10 concurrent calls
2. Start conservative, monitor 429 errors, increase if none appear

### The async Trap: Mixing Sync and Async

The most common mistake when integrating LLMs into existing Python code:

```python
# WRONG — this blocks the event loop
import httpx
def get_data():
    return httpx.get("https://api.example.com").json()  # Sync I/O inside async context

async def handler():
    data = get_data()  # Blocks the entire event loop for the duration of the HTTP call
```

If you call blocking I/O inside an async function without wrapping it in
`asyncio.run_in_executor()`, you freeze the entire event loop — all other requests stall.

```python
# CORRECT — offload blocking I/O to a thread pool
import asyncio
import httpx

def get_data_sync():
    return httpx.get("https://api.example.com").json()

async def handler():
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, get_data_sync)
```

**Production rule:** In any async codebase, every I/O operation must be `await`-ed.
If you can't avoid a blocking call (e.g., a legacy library), use `run_in_executor`.

---

## Part 3: FastAPI — The Right Web Framework for AI Services

### Why FastAPI (Not Flask, Not Django)

| Feature | Flask | Django | FastAPI |
|---------|-------|--------|---------|
| Async support | ❌ Bolted on | ❌ Partial | ✅ First-class |
| Automatic validation | ❌ Manual | ❌ Manual | ✅ Pydantic built-in |
| Streaming responses | ❌ Awkward | ❌ Awkward | ✅ `StreamingResponse` |
| OpenAPI docs | ❌ Extension needed | ❌ Extension needed | ✅ Auto-generated |
| Background tasks | ❌ Celery required | ❌ Celery required | ✅ Built-in |
| Type safety | ❌ None | ❌ None | ✅ End-to-end |

FastAPI is built on **Starlette** (async web framework) and **Pydantic** (validation).
It was designed for exactly the kinds of services LLM applications require.

### Pattern 1: Basic Typed AI Endpoint

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI
import asyncio

app = FastAPI()
client = AsyncOpenAI()

class SummarizeRequest(BaseModel):
    text: str
    max_sentences: int = 3

class SummarizeResponse(BaseModel):
    summary: str
    input_tokens: int
    output_tokens: int

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest) -> SummarizeResponse:
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Summarize the given text in {request.max_sentences} sentences."
                },
                {"role": "user", "content": request.text}
            ],
            max_tokens=512,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {str(e)}")

    return SummarizeResponse(
        summary=response.choices[0].message.content,
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
    )
```

**What FastAPI is doing automatically:**
- Deserializing and validating the request body against `SummarizeRequest`
- Returning a 422 Unprocessable Entity if validation fails (with field-level errors)
- Serializing the response against `SummarizeResponse`
- Generating OpenAPI docs at `/docs`
- Running the handler as a coroutine on the async event loop

### Pattern 2: Streaming Response (SSE)

For LLM streaming, you need Server-Sent Events (SSE). FastAPI has `StreamingResponse`
built in.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI
import asyncio

app = FastAPI()
client = AsyncOpenAI()

class ChatRequest(BaseModel):
    message: str

async def stream_llm_tokens(message: str):
    """Async generator that yields SSE-formatted token chunks."""
    stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": message}],
        stream=True,
        max_tokens=1024,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            # SSE format: "data: <content>\n\n"
            yield f"data: {delta.content}\n\n"

    yield "data: [DONE]\n\n"  # Signal completion to client

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_llm_tokens(request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        }
    )
```

**What the client receives** (incrementally, as tokens arrive):
```
data: The
data:  capital
data:  of
data:  France
data:  is
data:  Paris
data: [DONE]
```

**Production pitfall:** The `X-Accel-Buffering: no` header is critical. Without it,
Nginx buffers the entire SSE stream and delivers it all at once — defeating the purpose
of streaming. This is the most common streaming bug in production AI services.

### Pattern 3: Background Task for Long-Running Jobs

Some AI operations take too long for a synchronous HTTP request (e.g., processing a
100-page PDF, running a multi-step agent). The pattern: accept the job, return a job ID,
process asynchronously, allow the client to poll status.

```python
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import asyncio
import uuid

app = FastAPI()

# In production: use Redis or a database, not an in-memory dict
job_store: dict[str, dict] = {}

class ProcessRequest(BaseModel):
    document_url: str

async def process_document_task(job_id: str, url: str):
    """Long-running AI task that runs in the background."""
    job_store[job_id]["status"] = "processing"
    try:
        # Simulate a multi-step AI pipeline
        await asyncio.sleep(5)  # e.g., download + chunk + embed + store
        job_store[job_id] = {
            "status": "complete",
            "result": f"Processed document from {url}"
        }
    except Exception as e:
        job_store[job_id] = {"status": "failed", "error": str(e)}

@app.post("/process", status_code=202)
async def start_processing(request: ProcessRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job_store[job_id] = {"status": "queued"}
    background_tasks.add_task(process_document_task, job_id, request.document_url)
    return {"job_id": job_id, "status": "queued"}

@app.get("/process/{job_id}")
async def get_job_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, **job}
```

**FastAPI `BackgroundTasks` vs. Celery:**
- `BackgroundTasks` runs in the same process, in the same event loop.
  It's simple but doesn't survive a process restart. Suitable for low-volume,
  non-critical async work.
- Celery/Redis queues run in separate worker processes. Survives restarts,
  can scale horizontally, has retry logic. Required for production at scale.

**Use `BackgroundTasks` for:** Lightweight async side effects (logging, sending a webhook)  
**Use Celery/ARQ for:** Any job where loss on process restart is unacceptable

### Pattern 4: Dependency Injection for AI Clients

Never construct your `AsyncOpenAI` client inside request handlers — it's expensive
and re-creates connection pools on every request. Use FastAPI's dependency injection.

```python
from fastapi import FastAPI, Depends
from openai import AsyncOpenAI
from functools import lru_cache

app = FastAPI()

@lru_cache  # Module-level singleton — created once, reused across all requests
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI()  # Reads OPENAI_API_KEY from environment automatically

@app.post("/chat")
async def chat(
    message: str,
    client: AsyncOpenAI = Depends(get_openai_client)
):
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": message}],
        max_tokens=512,
    )
    return {"response": response.choices[0].message.content}
```

**Why `lru_cache` and not a global variable?**
`lru_cache` on a function means the result is computed once and cached. It's effectively
a singleton but with lazy initialization (created on first call, not at import time).
This matters for testing — you can override the dependency in tests without touching
global state.

### Pattern 5: Lifespan for Startup/Shutdown

FastAPI's lifespan context manager replaces the old `@app.on_event("startup")` pattern.
Use it to initialize AI clients, connection pools, and vector database connections once
at startup — not per request.

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from openai import AsyncOpenAI

# Application state holder
class AppState:
    openai_client: AsyncOpenAI = None

state = AppState()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize all AI clients and connections
    state.openai_client = AsyncOpenAI()
    print("AI clients initialized")

    yield  # Application runs here

    # Shutdown: close connections gracefully
    await state.openai_client.close()
    print("AI clients closed")

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Production rule:** Always close async clients on shutdown. `AsyncOpenAI` and similar
clients hold HTTP connection pools. Not closing them causes resource leaks and may
prevent clean shutdown in containerized environments.

---

## Architecture: How These Three Tools Wire Together

```
HTTP Client
    │
    ▼
FastAPI Route (async def)
    │
    ├─ Request body → Pydantic validation → typed Python object
    │
    ├─ Dependency Injection → pre-built AsyncOpenAI client
    │
    ▼
Business Logic Layer (async)
    │
    ├─ Call LLM via AsyncOpenAI (await)
    │
    ├─ Parse response with Pydantic model
    │
    ├─ ValidationError? → log, retry, or return structured error
    │
    ▼
FastAPI Response serialization → Pydantic model → JSON
    │
    ▼
HTTP Client
```

For streaming:
```
FastAPI Route
    │
    ▼
StreamingResponse wrapping async generator
    │
    ├─ Generator: await client.chat.completions.create(stream=True)
    │
    ├─ for each chunk: yield "data: <token>\n\n"
    │
    ▼
Client receives tokens incrementally via SSE
```

---

## Engineering Tradeoffs

| Decision | Option A | Option B | When to choose |
|----------|----------|----------|----------------|
| Response format | Structured outputs (OpenAI) | Prompt + Pydantic parsing | A: single-model, speed matters. B: multi-model, need portability |
| Background jobs | FastAPI BackgroundTasks | Celery + Redis | A: low volume, loss-tolerant. B: production at scale |
| AI client lifecycle | Global singleton | Dependency injection | DI always — testability + no hidden state |
| Concurrency | asyncio.gather (unbounded) | Semaphore-bounded gather | Always bounded in production |
| Streaming | StreamingResponse | Regular JSON | Stream for chat UX, regular for extraction/analysis |

---

## Common Engineering Mistakes

### Mistake 1: Synchronous client in async code
```python
# WRONG — blocks the event loop
from openai import OpenAI  # Sync client
client = OpenAI()

@app.post("/chat")
async def chat(message: str):
    response = client.chat.completions.create(...)  # Blocks everything
```

```python
# CORRECT
from openai import AsyncOpenAI  # Async client
client = AsyncOpenAI()

@app.post("/chat")
async def chat(message: str):
    response = await client.chat.completions.create(...)  # Non-blocking
```

### Mistake 2: Recreating clients per request
```python
# WRONG — new connection pool on every request
@app.post("/chat")
async def chat(message: str):
    client = AsyncOpenAI()  # Expensive!
    response = await client.chat.completions.create(...)
```

### Mistake 3: No ValidationError handling
```python
# WRONG — crashes on malformed LLM output
data = json.loads(llm_output)
result = MyModel(**data)  # ValidationError crashes the handler
```

```python
# CORRECT — structured error handling
try:
    data = json.loads(llm_output)
    result = MyModel(**data)
except json.JSONDecodeError as e:
    logger.error(f"LLM produced invalid JSON: {e}")
    raise HTTPException(status_code=502, detail="LLM output format error")
except ValidationError as e:
    logger.error(f"LLM output schema mismatch: {e.errors()}")
    raise HTTPException(status_code=502, detail="LLM output schema error")
```

### Mistake 4: Not setting response_model on routes
Without `response_model`, FastAPI serializes the entire return value, which may include
internal fields, database IDs, or API keys. Always specify `response_model` to control
exactly what the client receives.

---

## Production Pitfalls

### Pitfall 1: asyncio.gather without error handling
```python
# If one LLM call raises an exception, gather propagates it and the others may be lost
results = await asyncio.gather(*tasks)

# CORRECT — return exceptions instead of raising them
results = await asyncio.gather(*tasks, return_exceptions=True)
for r in results:
    if isinstance(r, Exception):
        logger.error(f"Task failed: {r}")
```

### Pitfall 2: Mutable default arguments in Pydantic
```python
# WRONG — same list instance shared across all instances
class Config(BaseModel):
    tags: list[str] = []  # This is actually safe in Pydantic (it copies), but...

# WRONG in standard Python dataclasses:
# @dataclass
# class Config:
#     tags: list = []  # All instances share this list!
```

Pydantic handles this correctly — it copies default values. But if you mix Pydantic
with regular dataclasses or dicts, you'll hit this classic Python bug.

### Pitfall 3: Thread safety of the event loop
`asyncio.run()` creates a new event loop. If you call it from a thread that already
has a running event loop (e.g., inside a Jupyter notebook or a sync endpoint in FastAPI),
you'll get `RuntimeError: This event loop is already running`. Use `asyncio.get_event_loop().run_until_complete()` or `nest_asyncio` for notebooks.

### Pitfall 4: FastAPI with sync routes and slow dependencies
FastAPI will run synchronous routes in a thread pool. But if your sync route calls
blocking I/O (like a sync LLM client), you'll exhaust the thread pool under load.
Either make the route `async def` with an async client, or ensure your sync operations
complete quickly.
