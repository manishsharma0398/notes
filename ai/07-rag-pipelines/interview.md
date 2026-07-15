# Chapter 7 — Interview Questions
## RAG Pipelines: Senior-Level Technical Interview Prep

---

## System Design Questions

### Q1: Design a RAG system for a 50,000-document enterprise knowledge base serving 500 concurrent users

**What the interviewer is testing:** Can you think end-to-end — ingestion, retrieval, scaling, cost?

**Strong answer outline:**

**Ingestion pipeline (offline):**
- Async job queue (Celery + Redis) triggered on document upload
- Document loader per format (PDF → unstructured, HTML → WebBaseLoader, DOCX → python-docx)
- Recursive text splitting: 500-token chunks, 50-token overlap
- Batch embedding: OpenAI text-embedding-3-small, 500 chunks/batch
- Upsert to Qdrant Cloud with metadata: tenant_id, doc_type, source_url, version, ingested_at
- Idempotency: hash document content, skip if unchanged

**Query pipeline:**
- FastAPI endpoint, async handlers
- Embed query (cached in Redis for identical queries, 1-hour TTL)
- Hybrid retrieval: Qdrant vector search + optional BM25 for exact terms
- Filter by tenant_id (isolation guarantee)
- Cohere rerank if latency budget allows (add ~300ms)
- Assemble context, call GPT-4o-mini with temperature=0
- Stream response via SSE

**Scaling to 500 concurrent users:**
- Embedding is stateless, scale horizontally
- Qdrant shards by default for large collections
- LLM is rate-limited — use multiple API keys or provision throughput units
- Cache popular queries (query hash → answer, short TTL)
- Separate read and write paths

**Cost estimate:**
- 50k docs × avg 5k tokens × 10 chunks/doc = 500M tokens to embed → ~$10 one-time
- Per query: 1 embed (500 tokens) + 5k context (GPT-4o-mini input) + ~500 output → ~$0.001/query
- 500 users × 20 queries/day = 10k queries/day → ~$10/day in LLM costs

---

### Q2: Your RAG system's answers are wrong even though the correct information is in the documents. How do you diagnose it?

**What the interviewer is testing:** Systematic debugging, not just guessing.

**Diagnostic steps:**

1. **Isolate retrieval from generation.** Run retrieval only and inspect top-k chunks.
   ```python
   docs = retriever.invoke(failing_query)
   for doc in docs: print(doc.page_content[:200], doc.metadata)
   ```
   - Is the correct chunk in the results? If yes → generation problem. If no → retrieval problem.

2. **If retrieval fails:**
   - Check cosine similarity scores. Are they all < 0.6? → No relevant content in index.
   - Check if the document is actually indexed. Query by source metadata.
   - Check vocabulary mismatch. The user says "cancel", the doc says "terminate". → Add query rewriting or hybrid BM25.
   - Check chunk size. Is the relevant sentence split across chunk boundaries? → Adjust chunk size/overlap.

3. **If retrieval succeeds but generation fails:**
   - Is the chunk in the prompt? Log the assembled prompt.
   - Is the LLM following instructions? Check if it's using training data instead. → Strengthen system prompt, reduce temperature.
   - Is the answer present but buried in the middle of 10 chunks? → Lost in the middle problem. Reduce k or reorder chunks.

4. **RAGAS scores:**
   - Low context_precision → Retrieval returns irrelevant chunks → Add re-ranking.
   - Low faithfulness → LLM is hallucinating beyond the context → Stronger prompt, lower k.

---

### Q3: What breaks if you scale your RAG system to 10 million documents?

**What the interviewer is testing:** ANN algorithm limits, cost projections, operational complexity.

**Memory:**
```
10M vectors × 1536 dims × 4 bytes = ~60 GB RAM
HNSW overhead (m=16): ~16 bytes/vector × 10M = ~160 MB (manageable)
Total: ~60 GB RAM for vectors alone
```
→ Need distributed vector store (Qdrant sharding, Pinecone, Milvus)

**Query performance:**
- HNSW still works at 10M with proper ef settings
- But recall starts degrading if `m` is too low — need to tune `m=32` or higher
- Build time for HNSW is O(n log n) — re-indexing 10M vectors takes hours

**Ingestion cost:**
```
10M docs × avg 5k tokens = 50B tokens to embed
At $0.02/1M tokens → $1,000 one-time embedding cost
Re-embedding on model upgrade → another $1,000
```
→ Lock in your embedding model. Model upgrades are expensive.

**Search quality:**
- At 10M vectors, false negatives (relevant doc not retrieved) increase
- Solution: Use IVF (Inverted File Index) with HNSW — trades some recall for memory efficiency
- Or: increase `ef` parameter at query time (but costs latency)

**Operational:**
- Separate collections per tenant becomes impractical at 10M × N tenants
- Move to single collection with strict tenant_id filtering + separate indexes per tenant if needed

---

## Concept Deep Dives

### Q4: Why does a cross-encoder (re-ranker) outperform bi-encoder (embedding) for relevance?

A bi-encoder embeds query and document *independently*, then computes cosine similarity. The model never "sees" both at once — it can't learn cross-attention between query tokens and document tokens.

A cross-encoder concatenates query + document as a single input: `[CLS] query [SEP] document [SEP]`. Every layer of the transformer runs attention across both. The model learns "what in the document is relevant to what in the query."

This is why cross-encoders are slower (must run inference for each candidate pair) but more accurate. Bi-encoders are fast because you pre-compute document embeddings and store them. You can't pre-compute cross-encoder scores.

**Trade-off:** Use bi-encoder for first-pass retrieval (fast, scales to millions of docs). Use cross-encoder for re-ranking top-20 candidates (accurate but only runs k times, not N times).

---

### Q5: When would RAG NOT be the right architecture?

1. **Queries requiring multi-hop reasoning across many documents:** RAG retrieves isolated chunks. If the answer requires synthesizing information from 20 different sources in complex ways, a single retrieval pass fails. → Use agentic RAG or graph-based retrieval.

2. **Real-time data:** RAG works off an indexed snapshot. If you need current stock prices, live inventory counts, or today's weather, RAG returns stale data from the last ingestion. → Use tool/function calling instead.

3. **Highly structured data queries:** "How many orders over $500 did we get last quarter?" → SQL query, not vector search. LLMs + SQL (text-to-SQL) work better here than RAG.

4. **Extremely small knowledge bases:** If you have 20 documents totaling 50k tokens, just put everything in the context (GPT-4o has 128k context). Skip RAG complexity entirely.

5. **Mathematical or procedural correctness:** If the answer requires exact computation or step-by-step logical reasoning, RAG + LLM may still hallucinate. → Use code execution tools.

---

### Q6: What is the "lost in the middle" problem and how do you engineer around it?

Research (Liu et al., 2023) shows LLM accuracy drops significantly when relevant information is in the middle of a long context. LLMs attend more strongly to content at the beginning and end.

**Engineering mitigations:**
1. **Reduce k:** Send 3-5 high-quality chunks instead of 15 mediocre ones
2. **Reorder:** Put most relevant chunk last (recency bias). Put second most relevant first.
3. **Structured prompts:** Use XML/markdown to label and separate chunks — helps model find relevant section
4. **Chunk compression:** Use LLM to extract only the relevant sentence from each chunk before assembling context (expensive but eliminates the problem)
5. **Re-ranking:** Ensure what goes into context is actually relevant, not just geometrically close

---

## Gotcha Traps

### "I'll use temperature=1 to make the RAG responses more natural"
Using temperature > 0 in RAG means the LLM might deviate from the retrieved context more. For factual Q&A over documents, temperature=0 is correct. Use temperature > 0 only for creative tasks.

### "If the LLM says 'according to the context', it's grounded"
LLMs can say "according to the context, the policy is X" even when X is not in the context. Faithfulness must be verified programmatically (RAGAS) or with an evaluator LLM, not by inspecting the text.

### "I'll use similarity_search_with_score() and filter by score > 0.5"
The absolute score threshold depends on your embedding model and the collection. A 0.5 with one model might be very irrelevant with another. Calibrate your threshold by looking at the score distribution on known-relevant and known-irrelevant pairs in your domain.

### "Re-indexing is easy — just delete and recreate"
At production scale, re-indexing takes hours and your system is blind during that window. Plan for blue-green ingestion: write to a new collection, validate, then switch the alias. Never delete your production collection before the new one is ready.
