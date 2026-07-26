# Cumulative Exercise — Chapters 1–8
## Build a Production-Grade Internal Knowledge Assistant

**Estimated time:** 2–3 hours

---

## Project Brief

You're the AI engineer at a mid-sized SaaS company. The support team gets 200+ questions/day about your product — things that are all documented but buried across 40+ internal Notion pages, PDFs, and Markdown files.

Your task: build an **internal knowledge assistant** that support agents can query in natural language and get grounded, cited answers. This is a real system — not a demo.

**Constraints that make this realistic:**
- Answers must include citations (which doc, which section)
- If the answer isn't in the docs, say so — no hallucinating
- Must handle both simple lookups AND complex multi-part questions
- Should detect when a query is too vague and ask for clarification (not just return garbage)
- Latency must be acceptable for a support agent workflow (< 3s for most queries)

---

## Simulated Knowledge Base

Use these documents as your "company docs" (save them as `.txt` or `.md` files):

```
docs/
  pricing.md        — Pro: $49/mo, Enterprise: $299/mo, limits per tier
  sla.md            — uptime guarantees, support response times per tier
  auth.md           — OAuth2 flow, token expiry, refresh procedure
  api-limits.md     — rate limits, throttling, 429 handling
  refunds.md        — 30-day money back, enterprise contract terms
  gdpr.md           — data residency, DPA availability, EU-specific features
  onboarding.md     — setup steps, initial config, common first-day issues
```

Fill these files with plausible but made-up content — it should read like real SaaS documentation. The content is yours to create.

---

## Phases

### Phase 1: Ingestion Pipeline
**Goal:** Load, chunk, embed, and store all docs with proper metadata.

Requirements:
- Load all `.md` files from `docs/` directory
- Chunk with `RecursiveCharacterTextSplitter` (experiment with chunk sizes)
- Embed with `text-embedding-3-small`
- Store in a vector DB (Chroma or Qdrant — your choice)
- Each chunk must have metadata: `source` (filename), `section` (header it belongs to), `ingested_at`
- Ingestion must be idempotent (re-running doesn't create duplicates)

**Success check:**
- [ ] All docs are in the vector store
- [ ] Each chunk has correct source + section metadata
- [ ] Re-running ingestion doesn't add duplicate vectors

---

### Phase 2: Hybrid Retriever
**Goal:** Combine BM25 + vector search with deduplication.

Requirements:
- `EnsembleRetriever` with BM25 + vector retrievers
- Tune weights for your doc domain
- Deduplication of results

**Success check:**
- [ ] Query "request throttling limits" retrieves the api-limits.md chunk even though the doc uses "rate limiting"
- [ ] Query "499 error handling" retrieves throttling docs (vocabulary mismatch test)

---

### Phase 3: Query Intelligence Layer
**Goal:** Route queries and rewrite when needed.

Requirements:
- **Complexity classifier**: Is this query simple (single fact) or complex (multi-part/comparative)?
- **Simple path**: Direct hybrid retrieval → answer
- **Complex path**: Decompose into sub-questions → parallel retrieval → merge results
- **Vague query detection**: If query is too vague ("tell me about pricing"), ask one clarifying question before retrieving

**Success check:**
- [ ] "What is the Pro plan price?" → simple path, fast answer
- [ ] "Compare Pro vs Enterprise for an EU company worried about GDPR compliance" → complex path, pulls from pricing.md + gdpr.md
- [ ] "Tell me about the API" → clarifying question asked before retrieval

---

### Phase 4: Grounded Answer Generation
**Goal:** Generate cited, faithful answers.

Requirements:
- Context assembled with source labels per chunk
- System prompt strongly enforces grounding
- Each answer includes citations: `[Source: pricing.md, Section: Pro Plan]`
- Score threshold: don't use chunks with relevance < 0.5
- Faithfulness grader runs post-generation (async logging, not blocking)

**Success check:**
- [ ] Answer to "What is the refund policy?" includes `[Source: refunds.md]`
- [ ] Query about something not in any doc returns: "I don't have information about that in the knowledge base"
- [ ] Faithfulness grader result is logged (even if not blocking the response)

---

### Phase 5: CLI Interface
**Goal:** Support agents can use this from the terminal.

Requirements:
- Simple interactive loop: user types query → gets answer with citations
- Multi-turn: agent can ask follow-up questions (no memory needed — just a clean new query each time is fine)
- Shows which docs were retrieved (so agents can read the source)
- Clearly shows when it doesn't know something

**Success check:**
- [ ] End-to-end: type a question, get cited answer, see source docs listed
- [ ] Works for at least 10 different questions from all docs
- [ ] Handles "I don't know" case gracefully

---

## Concepts from All Chapters Used Here

| Chapter | Concept applied |
|---------|----------------|
| Ch 1 | Tokenization awareness (chunk sizes, context limits) |
| Ch 2 | System prompt design for grounding + citation enforcement |
| Ch 3 | OpenAI API usage, cost/model selection, streaming |
| Ch 4 | Pydantic models for graders, async/await for parallel retrieval |
| Ch 5 | LangChain LCEL chains, RunnablePassthrough, StrOutputParser |
| Ch 6 | Embedding model choice, chunking strategy, vector DB setup |
| Ch 7 | Full RAG pipeline: loaders, re-ranking, context assembly, streaming |
| Ch 8 | Hybrid search, multi-query, query decomposition, Self-RAG graders |

---

## Success Criteria (Overall)

- [ ] Ingestion is idempotent and metadata-rich
- [ ] Hybrid retrieval measurably outperforms vector-only for exact term queries
- [ ] Complex multi-part questions get decomposed and answered from multiple docs
- [ ] All answers have source citations
- [ ] "I don't know" cases are handled cleanly (not hallucinated)
- [ ] CLI is usable by a non-technical support agent (clear prompts, readable output)
- [ ] You can explain every architectural decision you made

---

## Stretch Goals (if time allows)

- Add a RAGAS evaluation suite with 20 question/answer pairs covering all docs
- Replace CLI with a FastAPI endpoint + streaming SSE response
- Add Redis caching for embedding lookups on repeated queries
- Track which queries trigger the "complex path" and log the decomposed sub-questions

---

## Notes

- Write your own docs content — make it feel real (realistic prices, realistic SLA terms)
- No pre-built solution exists. Write everything from scratch using concepts from the chapters
- When you're done, share your solution for review
