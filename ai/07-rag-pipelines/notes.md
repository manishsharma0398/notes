# Chapter 7 — Revision Notes
## RAG Pipelines: Senior Engineer's Cheat Sheet

---

### Core Mental Model

```
RAG = database lookup + LLM formatting layer

NOT: "AI that knows your docs"
YES: "Retrieval system with LLM on top"

Most RAG failures = retrieval failures, not LLM failures.
```

---

### Naive RAG vs Production RAG

```
NAIVE:
  query → embed → top-k vector search → LLM

PRODUCTION:
  query → [rewrite] → embed → hybrid retrieval (vector + BM25)
       → [re-rank] → [score filter] → prompt assembly → LLM → [grounding check]
```

---

### Document Loaders

```python
# All LangChain loaders share the same interface:
loader = PyPDFLoader("file.pdf")
docs = loader.load()  # → List[Document(page_content, metadata)]

# ALWAYS enrich metadata at load time:
doc.metadata.update({"tenant_id": ..., "doc_type": ..., "ingested_at": ...})
```

| PDF Extractor | Use For |
|---------------|---------|
| `pypdf` | Simple text PDFs |
| `unstructured` | Tables, multi-column |
| `llamaparse` | Best quality, expensive |

---

### Retriever Types

```python
# Simple vector retrieval
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# MMR (balanced relevance + diversity)
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 5, "fetch_k": 20, "lambda_mult": 0.5}
)
```

**MMR:** fetches top-20, greedily selects 5 that are relevant to query AND diverse from each other.

---

### Re-Ranking (Cross-Encoder)

```
Bi-encoder (embedding):     separate embed(q) + embed(d) → cosine → fast but noisy
Cross-encoder (re-ranker):  [query + doc] → single model → score → slow but accurate

Rule: fetch 3-4x more than needed, rerank down to final k
Example: fetch top-20, rerank to top-5
```

```python
reranker = CohereRerank(model="rerank-english-v3.0", top_n=5)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=base_retriever,  # fetch top-20
)
```

---

### Context Assembly Rules

1. **Source labels** each chunk so LLM can cite
2. **Score-filter** chunks below 0.6 relevance — don't send garbage to LLM
3. **Lost in the middle:** put most relevant chunk last (recency bias in LLM attention)
4. **Never overflow** context window — cap at 5-10 chunks with 500-token chunks

---

### LCEL Chain Pattern

```python
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)
# Two API calls: embed query + LLM
```

---

### Latency Budget (p50)

```
Embed query:          80-120ms
Vector search:        20-50ms
Re-ranking (Cohere):  200-400ms  ← biggest optional cost
LLM TTFT (streaming): 400-800ms
────────────────────────────────
Without rerank:       ~600ms TTFT
With rerank:          ~900ms TTFT
```

---

### Key Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| "I don't have info" (but it's there) | Vocabulary mismatch | Query rewriting, hybrid search |
| LLM ignores context | Context too long, weak system prompt | Smaller k, stronger prompt |
| Wrong tenant data | Missing filter | Always filter by `tenant_id` |
| Stale answers | Index not updated | Delete + re-ingest on doc change |
| Context overflow | Too many/large chunks | Cap k, use re-ranking |

---

### Production Rules

1. **Score threshold:** Drop chunks < 0.6 similarity. Don't feed garbage to LLM.
2. **Multi-tenant:** Filter by `tenant_id` at query time. Separate collections for hard isolation.
3. **Streaming:** Always stream LLM output for user-facing apps.
4. **Evaluation:** Use RAGAS with context_recall + faithfulness metrics on a test set.
5. **Update pipeline:** Delete old vectors by source, re-ingest new. Don't accumulate duplicates.
6. **k selection:** Never use fixed k. Fetch 20, rerank to 5-8 based on score.

---

### RAGAS Evaluation Metrics

```
Context Recall    = % of ground truth facts present in retrieved chunks
Context Precision = % of retrieved chunks that are actually relevant
Answer Faithfulness = % of LLM answer grounded in retrieved context (not hallucinated)
Answer Relevancy  = does the answer address the question?
```

**Target minimums for production:** Context Recall > 0.85, Faithfulness > 0.90
