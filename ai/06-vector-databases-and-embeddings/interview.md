# Chapter 6 — Interview Questions
## Vector Databases & Embeddings

---

### Question 1
**"How does a vector database find similar documents without comparing against every vector in the index?"**

*What they're testing:* Do you understand ANN algorithms, or do you just know that "vectors" exist?

**Strong answer:**
Production vector DBs use **Approximate Nearest Neighbor (ANN)** algorithms, most commonly **HNSW (Hierarchical Navigable Small World)**.

HNSW builds a multi-layer graph at index time. Upper layers have sparse long-range connections for fast coarse navigation; lower layers are dense for precision. At query time, the algorithm enters the top layer, hops through the graph toward the query region, and descends to finer layers. It never compares against all vectors — it navigates the graph structure, achieving O(log n) search time instead of O(n × d).

The tradeoff: HNSW returns *approximate* nearest neighbors (~95-99% recall), not guaranteed exact matches. You tune `ef` at query time to trade recall for speed. In most production RAG systems, 97% recall is perfectly acceptable — the LLM's tolerance for slightly imperfect retrieval far exceeds the alternative of 10× slower exact search.

Memory cost: HNSW requires keeping the graph structure in RAM. A 1M vector index at dim=1536 needs roughly 6-12GB of RAM for the vectors + graph. Plan accordingly.

---

### Question 2
**"How would you architect a multi-tenant RAG system where tenants must not see each other's data?"**

*What they're testing:* Metadata filtering, isolation strategy, and understanding of vector DB capabilities.

**Strong answer:**
Two valid approaches, with different tradeoffs:

**Option A: One collection per tenant**
- Full isolation at the collection level
- Simplest reasoning about data separation
- Problem: if you have 10,000 tenants, managing 10,000 collections is operationally painful. Most vector DBs have per-collection overhead (memory for index, connection overhead).

**Option B: Shared collection + mandatory metadata filter**
- All tenants share one collection; each document payload includes `tenant_id`
- Every query includes `query_filter=Filter(must=[FieldCondition("tenant_id", match=...)])`
- Cheaper to operate; works well with Qdrant/Weaviate which support pre-filtering
- Risk: if a query path forgets the tenant filter, data leaks across tenants. Mitigate by wrapping all search calls in a `TenantSearchClient` class that injects the filter — no raw access to the underlying client.

**My choice for <100 tenants with varying data volumes:** Option A (separate collections per tenant, or per tenant per document type).
**For SaaS with thousands of tenants:** Option B with a strict filter-enforcement wrapper + integration tests that assert cross-tenant queries return nothing.

---

### Question 3
**"What happens if I embed documents with `text-embedding-3-small` but accidentally use `text-embedding-ada-002` for queries at search time?"**

*What they're testing:* Understanding of vector space geometry — a common silent failure.

**Strong answer:**
The results will be semantically meaningless, and **no error will be thrown** — that's what makes this dangerous.

Each embedding model learns its own geometry of semantic space. The angles and distances between points in `text-embedding-3-small`'s 1536-dimensional space are completely different from those in `text-embedding-ada-002`'s 1536-dimensional space, even though they're the same number of dimensions.

Cosine similarity between a query vector from model A and document vectors from model B measures nothing useful — it's comparing points on different maps. You'll get results back with reasonable-looking scores (say, 0.4–0.7), but they won't correlate with semantic similarity at all.

**How to prevent it:**
- Store the embedding model name in collection metadata at creation time
- Validate model name matches at query time
- Better: wrap your embedding + search client so model selection is centralized, not passed as a parameter that can differ between ingestion and query code paths

---

### Question 4
**"What breaks when you scale this RAG ingestion pipeline to 1 million documents per day?"**

*What they're testing:* Production thinking on batch size, rate limits, cost, and upsert performance.

**Strong answer:**

**Rate limits:** OpenAI embedding API has a token-per-minute limit (varies by tier, typically 1M-10M TPM). At 1M docs/day with avg 500 tokens/doc = 500M tokens/day. That's ~350k TPM required — beyond free tier. You need higher tier or multiple API keys with key rotation.

**Batching:** Never embed one chunk at a time. OpenAI accepts up to 2048 inputs per call. Use `asyncio.gather()` with concurrent batch calls, respecting rate limits with a semaphore or token bucket.

**Upsert bottleneck:** Vector DBs have ingest throughput limits. Qdrant recommends batching upserts at 1000-5000 points. For 1M docs chunked into 10M chunks, that's 2,000-10,000 upsert calls. Push via async workers.

**Cost:** 500M tokens/day × $0.02/1M = **$10/day for embeddings alone**. Multiply by model and tier.

**Re-embedding:** When you upgrade embedding models, you must re-embed the entire corpus. For 1M docs, that's 500M tokens — a one-time $10 bill just for the model upgrade. Cache the old embeddings in cold storage; don't delete until the new index is validated.

**Worker architecture:**
```
Kafka/SQS queue → worker pool (async Python) → embed batch (100 chunks) → upsert batch → Qdrant
                                              → dead-letter queue on failure
```
Use exponential backoff + dead-letter queue; don't lose documents on embedding API transient errors.
