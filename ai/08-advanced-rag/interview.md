# Chapter 8 — Interview Questions
## Advanced RAG: Senior-Level Interview Prep

---

## Architecture / Design Questions

### Q1: How would you design a production RAG system that handles both simple FAQ lookups and complex multi-document analytical questions at 50,000 requests/day?

**What to cover:**

- **Query routing layer**: Classify incoming queries (simple vs. complex) at ingress using a fast lightweight classifier. Simple → standard single-hop RAG. Complex → multi-hop with decomposition. This saves the majority of extra LLM calls since most production queries are simple.
- **Hybrid retrieval**: BM25 + vector for all queries — zero extra latency cost (parallel execution), big recall gain.
- **Decomposition pipeline**: For complex queries — LLM decomposes → async parallel sub-retrieval → deduplication → re-ranking → synthesis.
- **Cost allocation**: gpt-4o-mini for routing, graders, decomposers. gpt-4o only for final synthesis on complex queries.
- **Caching**: Redis for embedding cache (identical queries), sub-question retrieval cache (TTL = doc update frequency).
- **Observability**: Log retrieval scores, faithfulness grades, routing decisions. Alert when avg context recall drops.

**At 50k req/day (~35 req/min):** Batch embedding lookups where possible. Keep retrieval p95 < 300ms by self-hosting embedding model.

---

### Q2: What breaks in a multi-hop RAG system if you scale to 10,000 concurrent users?

**What to cover:**

- **LLM call explosion**: Each multi-hop query may need 5-10 LLM calls. At concurrency, this floods your LLM API rate limits. Mitigation: aggressive routing to prevent unnecessary multi-hop, async task queues (Celery/RQ), caching.
- **Retrieval fanout**: 4 sub-questions × 20 candidates each = 80 vector DB lookups per query. At high concurrency, this stresses the vector DB. Mitigation: connection pooling, read replicas, batching where possible.
- **Deduplication bottleneck**: Naive dedup with hash comparison is O(n²) across 80+ docs. Use a set with first-100-char hashes.
- **Context assembly costs money**: 10 chunks × 500 tokens = 5,000 tokens of input on top of the question. At scale, context tokens dominate LLM cost. Mitigation: stricter re-ranking to keep context lean (top-3 not top-10).
- **Timeout cascades**: If sub-question 3 of 4 times out, do you fail the entire request or answer with partial context? Need graceful degradation.

---

### Q3: Why does the `weights` parameter in `EnsembleRetriever` not actually change raw scores?

**Answer:** EnsembleRetriever uses RRF (Reciprocal Rank Fusion). RRF operates on *ranks*, not scores, because BM25 scores and cosine similarity scores are on fundamentally different scales (BM25 has no upper bound; cosine is [-1, 1]). The weights scale each retriever's rank contribution:

```
rrf_score(d) = Σ weight_i / (60 + rank_i(d))
```

A document appearing at rank 1 in vector search contributes `weight_vector / 61`. Changing weights biases which retriever's ranking dominates when there's a conflict — it does NOT combine raw scores.

---

## Concept / Tradeoff Questions

### Q4: When would HyDE perform *worse* than standard RAG?

**Answer:** HyDE fails when the LLM's hypothetical document is factually wrong in specific ways that shift the embedding toward incorrect document clusters.

**Concrete example:** Query: "What is the bug fix for Zephyr SDK v2.3.1's async context issue?"

LLM might generate: "In Zephyr SDK, the async context issue is resolved by calling `zephyr.flush()` before context switching..." — if `flush()` doesn't exist in Zephyr's actual API, this hypothetical doc embeds near generic async programming content, not Zephyr-specific bug reports.

**Standard RAG** would embed the original query, which at least has "Zephyr SDK v2.3.1" — hitting the exact-term neighborhood via semantic search.

**Rule:** HyDE is risky for queries about specific, rare, or proprietary technical details. It's valuable for natural language queries where the phrasing is far from document phrasing.

---

### Q5: You have a RAG system with context_recall = 0.91 but faithfulness = 0.72. What's the issue and how do you fix it?

**What this means:**
- High recall: your retriever IS finding the right chunks
- Low faithfulness: the LLM is NOT staying grounded in those chunks — it's mixing in training data

**Root causes:**
1. System prompt doesn't strongly enough enforce "use only context"
2. The LLM is "confident" from training on the topic and overrides the retrieved context
3. Context is too long (lost in the middle) — LLM loses track of constraints
4. Some chunks are borderline relevant, confusing the model into mixed generation

**Fixes in priority order:**
1. Tighten system prompt: "If information is not in the provided context, say 'I don't have information about that.' Do not use prior knowledge."
2. Reduce k — use top-3 high-confidence chunks rather than top-8 mixed-confidence chunks
3. Add Self-RAG faithfulness grader post-generation to catch and re-generate unfaithful answers
4. Use temperature=0 (further reduces creative deviation from context)

---

### Q6: What's the difference between query decomposition and iterative retrieval? When do you use each?

**Query decomposition:**
- Best when: question structure is known upfront — you can identify the sub-parts by reading the question
- Parallel: all sub-questions retrieved simultaneously
- Example: "Compare X vs Y on dimensions A, B, C" → split into ["X on A", "Y on A", "X on B", ...]

**Iterative retrieval:**
- Best when: you don't know what's missing until you've read the initial retrieved context
- Sequential: each iteration depends on what was found (or not found) in previous iteration
- Example: "What are the implications of policy X on department Y's workflow?" — you don't know what "implications" to retrieve until you've read what policy X says

**In practice:** Decomposition is faster (parallelizable). Iterative is smarter but slower (sequential dependencies). For most cases, decomposition is preferred. Use iterative only when queries genuinely require reading-then-refining.

---

## System Design Trap

### Q7: A teammate says "we should apply Self-RAG to all queries to guarantee quality." How do you respond?

**The trap:** Self-RAG sounds like a quality guarantee. It is not.

**Your response:**

1. **Cost reality**: Self-RAG adds 5-8 LLM calls per query. At 1,000 queries/day with gpt-4o-mini at $0.0004/1k tokens, that's manageable. At 100,000 queries/day, you're paying for 700,000+ extra LLM calls daily.

2. **Latency reality**: Serial grading adds 500-1,500ms. For a chat interface, users notice anything over 800ms before first token. Making faithfulness grading a *blocking* step (re-generate if unfaithful) kills perceived performance.

3. **Quality reality**: Faithfulness grading is itself imperfect — the grader LLM can misjudge. You're adding a stochastic check on a stochastic system. It reduces errors but doesn't eliminate them.

4. **The better approach**: Apply Self-RAG selectively to high-stakes answer domains (financial, legal, compliance data). Use async faithfulness logging for monitoring on all other queries — detect systematic issues in aggregate rather than per-request. Fix the root cause (retrieval quality, prompt engineering) rather than patching each response.

---

## Prediction Exercise

**Before reading the answer, predict:**

> You add HyDE to your RAG system. On your RAGAS eval set, context_recall goes from 0.78 → 0.85. But your engineering team reports that user satisfaction scores dropped slightly. What's happening?

*Think about it...*

**Answer:** HyDE improves average recall — but for the specific queries where it fails (exact product/version names), it fails *harder* than naive RAG. Users hitting those specific queries get worse answers than before. Aggregate RAGAS score improved because more queries got better retrieval, but the minority of users asking about specific proprietary details got noticeably worse answers. Fix: fallback to direct query embedding when HyDE-retrieved docs have low relevance scores.
