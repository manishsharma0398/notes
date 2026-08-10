# Cumulative Exercise — "DocBot" Knowledge Base Search API

## Project Brief

Build a **FastAPI service** that exposes a knowledge base search API backed by semantic search.
Users can upload documents, and the API answers natural language questions using retrieved context.

This is a minimal but complete production-like system — not a toy script, not a notebook.
It integrates concepts from all six chapters so far.

---

## Chapters Integrated

| Chapter | Concept Used |
|---------|-------------|
| 1 — How LLMs Work | Tokens, context window awareness |
| 2 — Prompt Engineering | System prompt design, few-shot, structured output |
| 3 — LLM APIs in Production | Streaming, async, retry, cost awareness |
| 4 — Python for AI Engineering | Pydantic models, async FastAPI handlers, error handling |
| 5 — LangChain Fundamentals | LCEL chain, output parser, `ainvoke` in async context |
| 6 — Vector DBs & Embeddings | Chunking, batched embedding, Qdrant search, metadata filter |

---

## System Overview

```
POST /documents          <- upload a document (plain text or markdown)
GET  /documents          <- list indexed documents
DELETE /documents/{id}   <- remove a document and its chunks

POST /search             <- semantic search, returns top-k chunks
POST /ask                <- ask a question; returns a generated answer + sources
GET  /ask/stream         <- same as /ask but streams the answer token by token
```

---

## Phase 1: Document Ingestion (Chapters 4, 6)

### What to build
- `POST /documents` accepts JSON: `{"name": "policy.md", "text": "..."}`
- Chunk text (RecursiveCharacterTextSplitter, 500 tokens, 10% overlap)
- Embed chunks in batch (OpenAI `text-embedding-3-small`)
- Upsert into Qdrant (in-memory mode)
- Return `document_id` (UUID), chunk count, token estimate

### Pydantic models to define

```python
class DocumentUploadRequest(BaseModel):
    name: str
    text: str

class DocumentUploadResponse(BaseModel):
    document_id: str
    name: str
    chunk_count: int
    estimated_tokens: int
```

### Success criteria
- [ ] Uploading a 2000-character document returns `chunk_count > 1`
- [ ] Second upload of different document does not overwrite first
- [ ] `GET /documents` lists all documents with ID and name
- [ ] Each chunk payload includes `document_id`, `name`, `chunk_index`

---

## Phase 2: Semantic Search Endpoint (Chapter 6)

### What to build
- `POST /search` body: `{"query": "...", "top_k": 3, "document_id": null}`
- If `document_id` provided, filter to that document's chunks only
- Return list of `SearchResult`

### Pydantic models

```python
class SearchRequest(BaseModel):
    query: str
    top_k: int = 3
    document_id: str | None = None

class SearchResult(BaseModel):
    score: float
    text: str
    source: str
    chunk_index: int
    document_id: str

class SearchResponse(BaseModel):
    results: list[SearchResult]
    query_embedding_tokens: int
```

### Success criteria
- [ ] Querying a topic in doc A returns chunks from doc A, not doc B
- [ ] Filtering by `document_id` only returns that document's chunks
- [ ] Scores ordered descending, all between 0 and 1
- [ ] Empty corpus returns empty results, not a 500 error

---

## Phase 3: Answer Generation (Chapters 2, 3, 5)

### What to build
- `POST /ask` body: `{"question": "...", "document_id": null, "top_k": 4}`
- Retrieve top-k chunks, build context string, call LLM, return structured answer

### Chain design (LangChain LCEL)

```
ChatPromptTemplate | ChatOpenAI | PydanticOutputParser
```

### System prompt to implement

```
You are a helpful assistant that answers questions about documents.
Answer ONLY using the provided context. If the answer is not in the context,
say exactly: "I don't have enough information to answer that."
Always cite which source document you used.
```

### Pydantic output model

```python
class AskResponse(BaseModel):
    answer: str
    sources: list[str]        # list of source document names used
    chunks_used: int
    question: str
```

### Success criteria
- [ ] Answering a question whose answer IS in the docs returns a correct answer
- [ ] Asking a question not covered returns "I don't have enough information..."
- [ ] `sources` list contains the actual document names used
- [ ] Handler is fully async — no `chain.invoke()`, only `chain.ainvoke()`
- [ ] LLM errors (rate limit, timeout) return HTTP 503, not 500

---

## Phase 4: Streaming Answer (Chapter 3)

### What to build
- `GET /ask/stream?question=...&document_id=...` streams the LLM answer token by token
- Uses `StreamingResponse` from FastAPI
- Client receives newline-delimited token chunks

### Success criteria
- [ ] Response starts arriving within 1 second of request
- [ ] Stream delivers the full answer when complete
- [ ] No buffering — first token arrives before full answer is ready

---

## Phase 5 (Stretch): Cost Tracking Middleware

Add a middleware or decorator that:
- Tracks total tokens used per request (embedding + LLM)
- Estimates cost per request (use current OpenAI pricing)
- Logs `{"request_id": ..., "embedding_tokens": ..., "llm_tokens": ..., "cost_usd": ...}`

### Success criteria
- [ ] Every `/ask` request logs a cost estimate
- [ ] Cost estimate is within 10% of actual (check against OpenAI dashboard)

---

## Project Structure (suggested)

```
docbot/
  main.py          # FastAPI app, route handlers
  embeddings.py    # embed_batch(), embed_query()
  vectorstore.py   # Qdrant init, upsert, search
  chunking.py      # document chunking logic
  llm.py           # LangChain chain, ask(), stream_ask()
  models.py        # All Pydantic request/response models
  requirements.txt
```

---

## Engineering Constraints

- All FastAPI handlers must be `async def`
- No synchronous blocking calls in any async handler
- Embedding calls must be batched — never one-per-chunk
- The Qdrant collection is created once at startup (`lifespan` event)
- All external API errors (OpenAI, Qdrant) must return structured JSON errors, not stack traces

---

## Notes

- Do NOT use LangChain's built-in vector store wrappers (e.g., `Qdrant.from_documents()`).
  Interact with Qdrant directly using `qdrant-client`. This is intentional — you need to understand
  what's happening at each layer.
- You may use LangChain for the LLM chain in Phase 3 only.
- Solve phases in order. Each phase builds on the previous one.
