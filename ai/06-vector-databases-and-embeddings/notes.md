# Chapter 6 — Revision Notes
## Vector Databases & Embeddings: Senior Engineer's Cheat Sheet

---

### Core Mental Model
```
Traditional DB:  row WHERE id = 42          (exact lookup)
Vector DB:       5 rows NEAREST TO [vector] (approximate geometric search)

Embeddings = float vectors that encode semantic meaning.
Similar meaning → nearby points in high-dimensional space.
```

---

### Embedding Facts to Memorize

| Model | Dim | Cost |
|-------|-----|------|
| text-embedding-3-small | 1536 | $0.02/1M tokens |
| text-embedding-3-large | 3072 | $0.13/1M tokens |
| nomic-embed-text (local) | 768 | free |

- OpenAI returns **L2-normalized** vectors (magnitude = 1)
- After L2 normalization: **dot product == cosine similarity** (cheaper to compute)
- Embedding model produces ONE vector per input, regardless of input length
- You embed documents at ingestion; you embed queries at search time — **two separate calls**

---

### Similarity Metrics

```
Cosine similarity  = dot(A, B) / (|A| × |B|)  → range [-1, 1], higher = more similar
Dot product        = Σ(Aᵢ × Bᵢ)               → equals cosine if L2-normalized
Euclidean (L2)     = sqrt(Σ(Aᵢ-Bᵢ)²)          → lower = more similar

Default for text: cosine. After normalization, use dot product (faster).
```

---

### ANN vs Exact Search

```
Exact:   100% recall, O(n × d) — too slow above ~100k vectors
HNSW:    ~95-99% recall, O(log n) — production standard

HNSW parameters:
  m               = connections per node (higher = better recall, more RAM)
  ef_construction = build quality (higher = better index, slower build)
  ef              = query recall (higher = better results, slower query)
  Typical: m=16, ef_construction=100, ef=64
```

---

### Chunking Decision Guide

| Strategy | When to use |
|----------|-------------|
| Recursive character splitting | Default for most text. Start here. |
| Fixed-size | Homogeneous content (logs, transcripts) |
| Semantic chunking | High-value docs where recall quality is critical |
| Structure-aware | Markdown, code, HTML — split on headers/functions |

**Starting defaults:** `chunk_size=500-1000 tokens`, `overlap=10-20%`
Tune by measuring retrieval precision/recall on real queries.

---

### Vector DB Quick Picks

```
Local/prototype    → Chroma (simplest) or Qdrant (local mode)
Managed production → Pinecone (easiest) or Qdrant Cloud (better $/perf)
Already on PG      → pgvector (< 1M vectors, good enough)
```

---

### Production Pipeline

```
INGESTION:
Doc → chunk (500-1000 tokens) → embed batch → upsert(vector + payload{text, source, ...})

QUERY:
user_query → embed (single call) → ANN search + metadata filter → top-k chunks → LLM
```

**Always store original text in payload.** Vector alone is useless at retrieval time.

---

### Critical Rules

1. **Same model for ingestion and query.** Different models = different vector spaces = garbage similarity scores. No error thrown.
2. **Always batch embedding calls.** Sequential embedding = 50-100× slower.
3. **Store text in payload.** You need it back at query time.
4. **Semantic search ≠ exact match.** For order IDs, product codes, use hybrid search (Ch. 8).
5. **Bigger chunks dilute the embedding signal** — one vector per chunk, more topics = weaker signal.

---

### Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Mix embedding models | Garbage similarity | Store model name in collection metadata |
| Embed one chunk at a time | Slow + rate limited | Use `embed_batch()` |
| Omit text from payload | Can't reconstruct answer | Always include `payload.text` |
| Chunk too large (>2000 tokens) | Diluted embeddings, weak retrieval | Tune chunk size empirically |
| Chunk too small (<100 tokens) | Missing context | Include overlap |
| Semantic search for exact terms | Misses "order #A12345" | Hybrid search |
| Post-filter on restrictive metadata | Fewer than k results returned | Pre-filter or use adaptive filter (Qdrant) |
