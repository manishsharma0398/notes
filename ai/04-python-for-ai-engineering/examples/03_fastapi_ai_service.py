"""
Example 3: FastAPI for AI Services

Demonstrates all five production FastAPI patterns:
  1. Basic typed endpoint with Pydantic request/response
  2. Streaming response (SSE)
  3. Background task with job polling
  4. Dependency injection for AI clients
  5. Lifespan context for startup/shutdown

Run:
  pip install fastapi uvicorn openai pydantic
  export OPENAI_API_KEY=your_key
  uvicorn 03_fastapi_ai_service:app --reload --port 8000

Then test:
  curl -X POST http://localhost:8000/summarize \
    -H "Content-Type: application/json" \
    -d '{"text": "FastAPI is a modern web framework for Python.", "max_sentences": 1}'

  curl -X POST http://localhost:8000/chat/stream \
    -H "Content-Type: application/json" \
    -d '{"message": "Explain async/await in Python"}' \
    --no-buffer

  curl -X POST http://localhost:8000/process \
    -H "Content-Type: application/json" \
    -d '{"document_url": "https://example.com/doc.pdf"}'
"""

import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Application State (initialized in lifespan) ──────────────────────────────


class AppState:
    """Holds shared application resources (clients, connections)."""
    openai_client: AsyncOpenAI = None


state = AppState()


# ─── Lifespan (Pattern 5: Startup/Shutdown) ───────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan replaces deprecated @app.on_event("startup"/"shutdown").

    All expensive initialization happens ONCE here:
    - AI client creation (sets up HTTP connection pool)
    - Database connection pools
    - Vector DB connections

    Not per-request. Per-process.
    """
    logger.info("Starting up: initializing AI clients")
    state.openai_client = AsyncOpenAI()

    # Could also initialize here: vector DB client, Redis, embedding model, etc.

    logger.info("Startup complete")
    yield  # Application runs here

    # Shutdown: close all connections gracefully
    logger.info("Shutting down: closing AI clients")
    await state.openai_client.close()
    logger.info("Shutdown complete")


app = FastAPI(
    title="AI Service",
    description="Production-ready AI service demonstrating FastAPI patterns",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── Dependency Injection (Pattern 4) ─────────────────────────────────────────


@lru_cache  # Module-level singleton — created once, reused across requests
def get_openai_client() -> AsyncOpenAI:
    """
    Dependency-injected AI client.

    lru_cache makes this a singleton — the AsyncOpenAI instance (and its
    underlying HTTP connection pool) is created once and shared.

    Why not a global variable?
    - This is testable: override the dependency in tests without touching globals
    - Lazy initialization: only created when first request arrives
    - Compatible with FastAPI's DI system
    """
    return AsyncOpenAI()


# ─── Pattern 1: Typed Endpoint ─────────────────────────────────────────────────


class SummarizeRequest(BaseModel):
    text: str = Field(min_length=10, description="Text to summarize")
    max_sentences: int = Field(default=3, ge=1, le=10)


class SummarizeResponse(BaseModel):
    summary: str
    input_tokens: int
    output_tokens: int
    model: str
    latency_ms: float


@app.post(
    "/summarize",
    response_model=SummarizeResponse,  # Controls what's serialized back — no leaking internals
    summary="Summarize text using LLM",
)
async def summarize(
    request: SummarizeRequest,
    client: AsyncOpenAI = Depends(get_openai_client),
) -> SummarizeResponse:
    """
    FastAPI does automatically:
    - Deserialize + validate request body against SummarizeRequest
    - Return 422 with field-level errors if validation fails
    - Serialize response against SummarizeResponse
    - Generate OpenAPI docs at /docs

    You don't write any of that code.
    """
    start = time.perf_counter()

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Summarize the text in exactly {request.max_sentences} sentences.",
                },
                {"role": "user", "content": request.text},
            ],
            max_tokens=512,
            temperature=0.0,
        )
    except Exception as e:
        # Convert LLM provider errors to HTTP 502 (Bad Gateway)
        # Don't expose internal error details to clients
        logger.error(f"LLM call failed: {e}")
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

    latency_ms = (time.perf_counter() - start) * 1000

    return SummarizeResponse(
        summary=response.choices[0].message.content,
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        model=response.model,
        latency_ms=round(latency_ms, 2),
    )


# ─── Pattern 2: Streaming Response (SSE) ──────────────────────────────────────


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    system_prompt: Optional[str] = "You are a helpful assistant."


async def stream_llm_tokens(message: str, system_prompt: str, client: AsyncOpenAI):
    """
    Async generator that yields SSE-formatted chunks.

    SSE format:
      data: <content>\n\n

    Each chunk is flushed immediately to the client.
    The client's JavaScript EventSource API receives these incrementally.
    """
    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            stream=True,
            max_tokens=1024,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                # Escape newlines in content to keep SSE format intact
                content = delta.content.replace("\n", "\\n")
                yield f"data: {content}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        # Even in a streaming context, we need to signal errors to the client
        error_payload = json.dumps({"error": str(e)})
        yield f"data: {error_payload}\n\n"
        logger.error(f"Streaming error: {e}")


@app.post("/chat/stream", summary="Stream LLM response via SSE")
async def chat_stream(
    request: ChatRequest,
    client: AsyncOpenAI = Depends(get_openai_client),
):
    """
    Returns a streaming SSE response.

    Key headers:
    - Cache-Control: no-cache → prevents proxies from caching the stream
    - X-Accel-Buffering: no  → disables Nginx response buffering (CRITICAL)

    Without X-Accel-Buffering: no, Nginx buffers the entire response and
    delivers it all at once — streaming appears to not work at all.
    """
    return StreamingResponse(
        stream_llm_tokens(request.message, request.system_prompt, client),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",  # CORS for browser SSE clients
        },
    )


# ─── Pattern 3: Background Task + Job Polling ─────────────────────────────────


# In production: replace with Redis or a database
# This in-memory store is lost on restart — acceptable only for demo or ephemeral jobs
job_store: dict[str, dict] = {}


class ProcessRequest(BaseModel):
    document_url: str
    processing_options: Optional[dict] = None


class JobStatus(BaseModel):
    job_id: str
    status: str  # queued | processing | complete | failed
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: float
    completed_at: Optional[float] = None


async def run_ai_pipeline(job_id: str, url: str, client: AsyncOpenAI):
    """
    Long-running AI pipeline:
      1. Fetch document (simulated)
      2. Extract text (simulated)
      3. Call LLM for analysis
      4. Store result

    In production: this function body becomes a Celery task or an ARQ job.
    FastAPI BackgroundTasks is fine for low-volume, loss-tolerant jobs.
    """
    job_store[job_id]["status"] = "processing"

    try:
        # Step 1: Simulate document fetching (would use httpx in production)
        await asyncio.sleep(1)
        document_text = f"Simulated content from {url}"

        # Step 2: LLM analysis
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Analyze the document and provide a summary."},
                {"role": "user", "content": document_text},
            ],
            max_tokens=256,
        )

        job_store[job_id].update({
            "status": "complete",
            "result": response.choices[0].message.content,
            "completed_at": time.time(),
        })
        logger.info(f"Job {job_id} completed")

    except Exception as e:
        job_store[job_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": time.time(),
        })
        logger.error(f"Job {job_id} failed: {e}")


@app.post("/process", status_code=202, summary="Start async document processing")
async def start_processing(
    request: ProcessRequest,
    background_tasks: BackgroundTasks,
    client: AsyncOpenAI = Depends(get_openai_client),
):
    """
    Accepts a job and returns immediately with a job_id.
    Client polls /process/{job_id} to check status.

    202 Accepted = "we got your request, processing is in progress"
    This is the correct HTTP status for async work acceptance.
    """
    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "status": "queued",
        "created_at": time.time(),
        "result": None,
        "error": None,
        "completed_at": None,
    }

    # BackgroundTasks runs AFTER the response is sent to the client
    background_tasks.add_task(run_ai_pipeline, job_id, request.document_url, client)

    return {"job_id": job_id, "status": "queued"}


@app.get("/process/{job_id}", response_model=JobStatus, summary="Poll job status")
async def get_job_status(job_id: str):
    """Poll this endpoint after starting a /process job."""
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return JobStatus(job_id=job_id, **job)


# ─── Health Check ──────────────────────────────────────────────────────────────


@app.get("/health", summary="Service health check")
async def health():
    """
    Health check for load balancer / k8s liveness probe.
    In production: also check LLM API reachability and DB connection.
    """
    return {
        "status": "ok",
        "ai_client_initialized": state.openai_client is not None,
    }


# ─── Development Entry Point ───────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # Run with: python 03_fastapi_ai_service.py
    # Or: uvicorn 03_fastapi_ai_service:app --reload
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
