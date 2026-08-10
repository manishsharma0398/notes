# Cumulative Exercise — Chapters 1–5

**Scope:** LLM internals (Ch.1) · Prompt engineering (Ch.2) · LLM APIs (Ch.3) · Python for AI engineering (Ch.4) · LangChain LCEL (Ch.5)  
**Estimated time:** 1–3 hours  
**Rules:** Write all code yourself. No pre-built solutions. Build something you'd actually be proud to show.

---

## Project: AI-Powered Code Review Assistant API

You will build a production-ready FastAPI service that reviews code snippets using an LLM pipeline built with LCEL. It must handle concurrent requests, stream output to clients, return structured feedback, and be robust to LLM failures.

This is the kind of tool that a real engineering team might actually deploy as an internal developer tool.

---

## The Brief

A senior engineering team wants an internal API service called **CodeReview AI**.

Given a code snippet and programming language, the service should:
1. Analyse the code across **three dimensions simultaneously** (bugs, best practices, security)
2. Return a **structured review** with typed fields (Pydantic model)
3. Stream the most important dimension (security) live to the caller
4. Support reviewing **multiple snippets in one request** (batch endpoint)
5. Handle LLM failures gracefully — a failed analysis should return an error flag, not crash
6. Include a **health endpoint** that shows model status

---

## API Specification

### `POST /review` — Single review, streaming
Request:
```json
{
  "code": "def get_user(id):\n    return db.execute(f'SELECT * FROM users WHERE id={id}')",
  "language": "python"
}
```

Response: Server-Sent Events (SSE) stream  
Stream format: security analysis tokens, then `[DONE]` event  
After stream ends: client polls `/review/{review_id}` for full structured result

### `POST /review/batch` — Multiple snippets, concurrent
Request:
```json
{
  "snippets": [
    {"code": "...", "language": "python"},
    {"code": "...", "language": "javascript"}
  ]
}
```

Response: Full structured results for all snippets (concurrent, not sequential)

### `GET /review/{review_id}` — Retrieve stored result
Response: Full `CodeReview` structured object

### `GET /health` — Model health check
Response: `{"status": "ok", "model": "gpt-4o-mini", "latency_ms": 234}`

---

## Pydantic Data Contracts

Define these models yourself. They must include at least:

**`CodeIssue`:**
- `severity`: Literal["info", "warning", "error", "critical"]
- `category`: str (e.g. "SQL injection", "missing type hint")
- `line_hint`: Optional[str]
- `description`: str
- `fix_suggestion`: str

**`CodeReview`:**
- `review_id`: str (UUID)
- `language`: str
- `overall_score`: int (1–10, where 10 is excellent)
- `bugs`: list[CodeIssue]
- `best_practices`: list[CodeIssue]
- `security`: list[CodeIssue]
- `summary`: str
- `success`: bool
- `error`: Optional[str]
- `processing_time_ms`: float

---

## Phases

### Phase 1: LCEL Pipeline (Core Logic)
*~30 minutes*

Build three separate analysis chains using LCEL:

```
bugs_chain:           prompt | llm | PydanticOutputParser(CodeIssueList)
best_practices_chain: prompt | llm | PydanticOutputParser(CodeIssueList)
security_chain:       prompt | llm | StrOutputParser()  (for streaming)
```

Run them in parallel via `RunnableParallel`.

**Success criteria:**
- [ ] All three chains run concurrently on the same `{"code": ..., "language": ...}` input
- [ ] Bugs and best practices return validated `list[CodeIssue]`
- [ ] Security chain can be streamed token-by-token

### Phase 2: FastAPI Service
*~30–45 minutes*

Build the FastAPI app with the four endpoints listed above.

**Requirements:**
- `AsyncOpenAI` or `ChatOpenAI` client as a singleton (DI pattern from Ch.4)
- Streaming endpoint uses `StreamingResponse` with SSE format
- Background task stores result in an in-memory dict keyed by `review_id`
- Batch endpoint uses `abatch()` with `max_concurrency=3`
- Health endpoint makes a lightweight test call and measures latency

**Success criteria:**
- [ ] `POST /review` returns a streaming SSE response (security analysis tokens arrive live)
- [ ] `GET /review/{review_id}` returns the full `CodeReview` object after streaming completes
- [ ] `POST /review/batch` with 5 snippets completes in roughly 1× LLM latency (concurrent)
- [ ] A bad API key returns `{"success": false, "error": "..."}` — no 500 crash

### Phase 3: Prompt Engineering
*~20–30 minutes*

Design your prompts with knowledge from Chapter 2:

**Apply:**
- System prompt with clear role and strict output format instructions
- Few-shot examples for the bug/best-practices parsers (2 examples each)
- Chain-of-thought instruction for security analysis ("Think step by step about potential vulnerabilities...")
- `temperature=0.0` for deterministic, repeatable reviews

**Success criteria:**
- [ ] The SQL injection example in the API spec is flagged as `"critical"` severity in the security analysis
- [ ] The review for a clean snippet returns `overall_score >= 8`
- [ ] Two runs of the same code snippet produce identical or near-identical results

### Phase 4: Resilience and Observability
*~20 minutes*

**Add:**
- Retry with exponential backoff (tenacity or httpx built-in) for transient 429/503 errors
- Structured JSON logging for each request: `review_id`, `language`, `processing_time_ms`, `success`
- Rate limiting: max 5 concurrent LLM calls across the entire service (Semaphore)
- `X-Processing-Time-Ms` response header on all endpoints

**Success criteria:**
- [ ] Logs are structured JSON (not print statements)
- [ ] Simulating a 429 error triggers a retry and eventually succeeds
- [ ] 10 concurrent batch requests don't exceed the semaphore limit

---

## Test Cases

Verify your service with these curl commands:

```bash
# 1. Single review — streaming (should see tokens arrive live)
curl -N -X POST http://localhost:8000/review \
  -H "Content-Type: application/json" \
  -d '{"code": "def get_user(id):\n    return db.execute(f'\''SELECT * FROM users WHERE id={id}'\'')", "language": "python"}'

# 2. Retrieve stored result after streaming
curl http://localhost:8000/review/{review_id_from_above}

# 3. Batch review
curl -X POST http://localhost:8000/review/batch \
  -H "Content-Type: application/json" \
  -d '{
    "snippets": [
      {"code": "const x = eval(userInput)", "language": "javascript"},
      {"code": "password = \"admin123\"", "language": "python"},
      {"code": "def add(a, b):\n    return a + b", "language": "python"}
    ]
  }'

# 4. Health check
curl http://localhost:8000/health
```

---

## Success Criteria (Full Project)

- [ ] The SQL injection code is flagged as `critical` in security analysis
- [ ] `eval(userInput)` is flagged as `critical`
- [ ] Hardcoded password is flagged as `critical` or `error`
- [ ] Clean `add(a, b)` function scores `>= 8`
- [ ] Streaming endpoint delivers tokens live (visible with `curl -N`)
- [ ] Batch of 3 snippets completes in ~1× LLM call time (not 3×)
- [ ] Structured JSON logs appear in the terminal for each request
- [ ] Bad API key returns `{"success": false}`, not a 500

---

## What You'll Have Built

A production-worthy internal developer tool with:
- LCEL parallel pipeline with structured output
- Streaming FastAPI endpoint
- Concurrent batch processing
- Error resilience
- Structured observability

This would be a solid portfolio piece and demonstrates exactly the skills a senior AI engineering role expects.

---

## Extension Challenges (Optional)

If you finish early:

1. **Add a diff-based review**: Accept a `git diff` instead of a full file and review only changed lines
2. **Semantic similarity deduplication**: Before running the full analysis, check if a near-identical snippet was reviewed recently (using OpenAI embeddings + cosine similarity) and return the cached result
3. **LangSmith tracing**: Add per-request LangSmith tracing using `RunnableConfig`
4. **GitHub PR integration**: Accept a GitHub PR URL, fetch the diff via the GitHub API, and run the review pipeline on each changed file
