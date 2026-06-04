# Cumulative Exercise — Chapters 1–4

**Covers:** LLM internals · Prompt engineering · LLM APIs in production · Python for AI engineering  
**Estimated time:** 2–4 hours (split across sessions)  
**Rules:** Write all code yourself. No AI-generated solutions. Build something you'd show in a portfolio.

---

## Project: SmartDoc — A Document Q&A API

Build a small but production-quality FastAPI service that answers questions about
uploaded text documents. A user uploads a document, asks questions about it, and
gets structured, cited answers back — with full production safeguards.

This is a simplified but realistic version of what every enterprise AI product does.

---

## What You're Building

```
                         SmartDoc API
                         ┌──────────────────────────────────────┐
  POST /documents        │                                      │
  (plain text body)  ──▶ │  Store document in memory           │
                         │  Return document_id                  │
                         │                                      │
  POST /ask              │  Load document by ID                 │
  {document_id, question}│  Build prompt with context           │
                     ──▶ │  Call LLM (async, with retry)        │
                         │  Parse + validate structured response│
                         │  Return typed answer                 │
                         │                                      │
  GET /documents/{id}    │  Return document metadata            │
                         └──────────────────────────────────────┘
```

---

## Phase 1 — Data Layer (No LLM yet)

Build the document store and API skeleton. No LLM calls in this phase.

**Tasks:**
- [ ] Define a `Document` Pydantic model with: `id` (UUID), `content` (str), `word_count` (int), `created_at` (datetime)
- [ ] Define an `AskRequest` model: `document_id` (UUID), `question` (str, 10–500 chars)
- [ ] Implement `POST /documents` — accepts plain text body, stores in-memory dict, returns the `Document`
- [ ] Implement `GET /documents/{document_id}` — returns document metadata (not content), 404 if not found
- [ ] Implement `GET /health` — returns `{"status": "ok", "documents_loaded": N}`

**Verify:**
```bash
# Upload a document
curl -X POST http://localhost:8000/documents \
  -H "Content-Type: text/plain" \
  -d "Python is a high-level programming language..."

# Should return: {"id": "...", "word_count": N, "created_at": "..."}

# Retrieve metadata
curl http://localhost:8000/documents/{id}

# Check health
curl http://localhost:8000/health
```

---

## Phase 2 — LLM Integration with Structured Output

Add the `/ask` endpoint with a real LLM call and structured output validation.

**The LLM must return structured data, not a plain string. Define this yourself:**

The answer response must include at minimum:
- The answer text
- Confidence level: `"high"`, `"medium"`, or `"low"`
- Whether the answer is grounded in the document (`found_in_document: bool`)
- A direct quote from the document that supports the answer (or null if not found)
- Token usage (input + output)

**Tasks:**
- [ ] Design a system prompt that instructs the model to return JSON with the above fields
- [ ] Implement `POST /ask` — calls the LLM with document context + question
- [ ] Parse and validate the LLM response with Pydantic (handle malformed output)
- [ ] Return 404 if `document_id` doesn't exist
- [ ] Return 502 with a clear error if the LLM call fails
- [ ] The LLM client must be a singleton (not created per request)

**Verify:**

Upload a document, then:
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"document_id": "...", "question": "What is the main topic of this document?"}'

# Expected: structured JSON with answer, confidence, quote, token usage
```

- [ ] Does the `quote` field actually appear in the document content?
- [ ] Does `found_in_document: false` trigger when you ask a question the document can't answer?

---

## Phase 3 — Production Hardening

Apply everything from Chapter 3 (APIs in production) and Chapter 4 (Python patterns).

**Tasks:**
- [ ] Add retry logic for 429 and 5xx errors using `tenacity` (max 3 retries, exponential backoff + jitter)
- [ ] Add a `max_tokens` limit to every LLM call
- [ ] Add `temperature=0.0` for deterministic answers
- [ ] Log each request: `document_id`, `question_length`, `input_tokens`, `output_tokens`, `latency_ms`, `confidence`
- [ ] Add a concurrency semaphore: max 5 simultaneous LLM calls (even within a single `/ask` batch)
- [ ] Add proper startup/shutdown using FastAPI lifespan (initialize client on startup, close on shutdown)

**Verify:**
- [ ] Set `OPENAI_API_KEY` to something invalid — does `/ask` return a clean 502 instead of a 500 traceback?
- [ ] Add a `print()` in your retry handler and trigger a 429 manually (or simulate it) — do you see retries?
- [ ] Check your logs — does every `/ask` call log token usage and latency?

---

## Phase 4 — Prompt Engineering (Chapter 2 concepts)

Make your answers better by applying what you learned about prompts.

**Tasks:**
- [ ] Add a few-shot example to your system prompt showing the expected JSON output format
- [ ] Add a chain-of-thought instruction: tell the model to reason step by step before answering
- [ ] Implement a `mode` parameter in `AskRequest`: `"precise"` (low temperature) vs `"exploratory"` (higher temperature)
- [ ] Test: does adding chain-of-thought improve `found_in_document` accuracy on tricky questions?

**Verify:**
Upload a technical document (e.g., paste in a Wikipedia article). Then ask:
- A question directly answered in the document → should be `found_in_document: true, confidence: high`
- A question NOT in the document → should be `found_in_document: false`
- A question requiring inference → should be `confidence: medium` or `low`

Does your prompt reliably distinguish these cases?

---

## Final Checklist — "Would I Ship This?"

Before considering this done, verify:

- [ ] No secrets (API keys) hardcoded — reads from environment variable
- [ ] All endpoints have proper HTTP status codes (200, 201, 404, 422, 502)
- [ ] Input validation at the API layer (Pydantic catches bad input before LLM call)
- [ ] LLM output validation (Pydantic catches bad model output before returning to client)
- [ ] Every LLM call has `max_tokens` set
- [ ] Retry logic in place for transient failures
- [ ] Client is a singleton (not created per request)
- [ ] Structured logging per request (at minimum: latency + tokens)
- [ ] `/health` endpoint works

---

## Stretch Goals (Optional)

If you finish early and want a challenge:

1. **Add streaming** — implement `POST /ask/stream` that streams the answer token by token via SSE
2. **Add basic caching** — if the same `(document_id, question)` pair is asked twice, return the cached answer (in-memory dict keyed by `hash(document_id + question)`)
3. **Add a context window guard** — if the document is too long to fit in the prompt, truncate it and log a warning
4. **Add token budget tracking** — track total tokens used across all requests (in-memory counter) and expose it on `/health`

---

## Skills Demonstrated

When you finish this project, you will have hands-on proof of:

| Skill | Where it shows |
|-------|---------------|
| LLM internals (Ch1) | Understanding why `temperature=0` gives deterministic output; why `max_tokens` matters |
| Prompt engineering (Ch2) | System prompt design; few-shot examples; chain-of-thought |
| LLM APIs in production (Ch3) | Retry logic; rate limit awareness; token tracking; error classification |
| Python for AI engineering (Ch4) | Pydantic models; async/await; FastAPI patterns; DI; lifespan |
