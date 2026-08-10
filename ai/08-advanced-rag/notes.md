# Chapter 8 — Revision Notes
## Advanced RAG: Senior Engineer's Cheat Sheet

---

### Why Basic RAG Fails (the 4 weaknesses)

```
1. Vocabulary mismatch   → user says "cancel", docs say "terminate"
2. Query ambiguity       → vague query → vague embedding → wrong chunks
3. Single-hop limit      → complex questions need facts from multiple docs
4. No feedback loop      → bad retrieval passes through silently
```

---

### Hybrid Search (BM25 + Vector)

```
Dense (vector):  semantic similarity — great for meaning, fails on exact terms
Sparse (BM25):   exact term matching — great for jargon/codes, fails on semantics

Combination: RRF (Reciprocal Rank Fusion)
  rrf_score(d) = Σ weight_i / (60 + rank_i(d))
  Rewards docs that rank well in BOTH systems.
  Scores are not averaged — RANKS are combined.
```

```python
ensemble_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    weights=[0.6, 0.4]  # vector weighted higher for semantic domains
)
```

**Use always in production.** BM25 retriever is in-memory (bad at scale) — use Qdrant sparse vectors or Elasticsearch for real deployments.

---

### Query Rewriting Techniques

| Technique | How it works | Extra cost | Best for |
|-----------|-------------|------------|---------|
| **HyDE** | Generate hypothetical answer, embed that | 1 LLM call | Query-doc vocabulary gap |
| **Multi-query** | Generate 3 query variants, retrieve all, union | 1 LLM + 3x retrieval | Complex/ambiguous queries |
| **Step-back** | Abstract to general question, retrieve for that | 1 LLM call | Over-specific queries |

```python
# HyDE: embed the answer, not the question
hypothetical_doc = llm.invoke("Write a plausible answer to: {query}")
results = vectorstore.similarity_search_by_vector(embed(hypothetical_doc))

# Multi-query: union of all variants
multi_query_retriever = MultiQueryRetriever.from_llm(retriever=base_retriever, llm=llm)
```

**HyDE failure mode:** LLM hallucinates specific wrong facts → embedding misdirected → wrong docs retrieved.

---

### Self-RAG (Conditional Retrieval + Self-Critique)

```
Standard RAG: always retrieve → always use all chunks → always answer
Self-RAG:     [RETRIEVE?] → retrieve → [RELEVANT?] → generate → [GROUNDED?]
```

**4 graders:**
1. **Retrieval decision** — does this query need docs at all?
2. **Chunk relevance** — filter irrelevant chunks before generation
3. **Faithfulness** — is every claim in the answer supported by context?
4. **Answer relevancy** — does the answer address the question?

```python
# Structured output grader pattern
class FaithfulnessGrade(BaseModel):
    is_faithful: bool
    unsupported_claims: list[str] = []

grader = prompt | llm.with_structured_output(FaithfulnessGrade)
```

**Cost:** ~8x basic RAG (5-chunk query). Worth it for high-stakes, low-volume use cases. Parallelize chunk grading with `asyncio.gather()`.

---

### Multi-Hop Retrieval

```
Use when: question needs facts from multiple documents that no single query retrieves

Technique 1: Query Decomposition
  "Compare Pro vs Enterprise for EU + GDPR"
  → ["What is Pro plan pricing?", "What is Enterprise plan pricing?",
     "What are EU regional pricing rules?", "Which GDPR features per tier?"]
  → Retrieve each → deduplicate → synthesize

Technique 2: Iterative Retrieval
  Retrieve → assess what's missing → re-retrieve → repeat (max 3 iterations)
```

**ALWAYS parallelize sub-question retrievals:**
```python
results = await asyncio.gather(*[retriever.ainvoke(q) for q in sub_questions])
```

---

### Decision Tree: Which Technique to Use

```
Complex/multi-part query?    → Decomposition + Multi-Hop
Exact terms in domain?       → Hybrid Search (always)
Vague or abstract query?     → Multi-Query or HyDE
High faithfulness required?  → Self-RAG graders
Low context_recall score?    → Hybrid + Query Rewriting
All metrics OK?              → Don't add complexity
```

---

### Cost Reality Check

```
Basic RAG:                   2 API calls (embed + LLM)
+ Hybrid search:             0 extra (parallel BM25)
+ Multi-query (3 variants):  +1 LLM + 3x retrieval
+ HyDE:                      +1 LLM call
+ Self-RAG (5 chunks):       +8 LLM calls total (~8x cost)
+ Iterative (3 hops):        +3 retrieval + 3 assessment calls
```

---

### Production Rules

1. **Always use hybrid search** — BM25 costs nothing extra at query time; it fills gaps vector search misses
2. **Parallelize everything** — multi-query, decomposed sub-questions, chunk graders — all async
3. **Route by complexity** — classify simple vs. complex at ingress; only apply multi-hop to complex
4. **Use gpt-4o-mini for graders** — graders don't need frontier capability; 10x cheaper
5. **Cache sub-question results** — Redis cache on sub-questions across multi-hop sessions
6. **Measure before adding** — run RAGAS first; only add technique targeting your specific bottleneck

---

### Key Interview Questions

**"BM25 vs vector search"** → complementary, not competing. Use both. RRF combines ranks, not raw scores.

**"When does HyDE fail?"** → when the hypothetical answer is factually wrong, the embedding misdirects retrieval. Worse than naive RAG in that case. Use for vocab gap, not specific factual queries.

**"Design multi-hop for 10k req/day"** → route (classify complexity), parallelize (asyncio), cache (Redis on sub-Qs), use mini model for graders, measure recall first.

**"Is Self-RAG practical?"** → the pattern yes, the paper's trained model no. Key: make graders async/non-blocking; log faithfulness for monitoring rather than always re-generating.
