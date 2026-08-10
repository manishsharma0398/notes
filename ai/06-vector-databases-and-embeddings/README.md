# Chapter 6 — Vector Databases & Embeddings
## Mental Model, Architecture, and Engineering Tradeoffs

---

## 1. The Core Mental Model

Most engineers first think of databases as storing **values you look up by key** — SQL rows by primary key, Redis by string key. Vector databases do something fundamentally different: they store **geometric points in high-dimensional space** and answer **"what is near this point?"** queries.

That's it. Everything else is implementation detail.

```
Traditional DB:  "Give me the row WHERE id = 42"
Vector DB:       "Give me the 5 rows geometrically NEAREST to [0.12, -0.83, 0.44, ...]"
```

The "geometric points" are **embeddings** — floating-point vectors that encode semantic meaning. Two semantically similar things end up at points close together in this high-dimensional space.

```
"How do I reset my password?"      → [0.12, -0.83, 0.44, ...]
"I forgot my password"             → [0.14, -0.81, 0.42, ...]   ← similar direction
"What's the capital of France?"    → [-0.67, 0.23, -0.91, ...]  ← very different direction
```

**Why this matters for AI:** LLMs have fixed context windows. You can't stuff 10,000 documents into a prompt. Vector search lets you pull only the *semantically relevant* documents — "smart CTRL+F" at scale.

---

## 2. What Embeddings Actually Are

An embedding model is a neural network trained to map variable-length text to a **fixed-size float vector**. The exact mechanism:

1. Text is tokenized (same BPE tokenization as LLMs)
2. Tokens pass through the transformer's attention layers
3. The final [CLS] token's hidden state (or mean-pooled hidden states) is taken as the embedding
4. This vector is L2-normalized (magnitude = 1) so distances are purely directional

```
"user forgot password"
         |
   [tokenize: 3 tokens]
         |
   [transformer layers: ~12-24 layers of attention + FFN]
         |
   [pool hidden states → single vector]
         |
   [L2 normalize]
         |
   [0.12, -0.83, 0.44, 0.07, -0.21, ...]  ← 1536 floats (OpenAI text-embedding-3-small)
```

**Dimensionality examples:**
| Model | Dimensions | Params | Cost |
|-------|-----------|--------|------|
| OpenAI text-embedding-3-small | 1536 | ~20M | $0.02/1M tokens |
| OpenAI text-embedding-3-large | 3072 | ~120M | $0.13/1M tokens |
| Cohere embed-v3 | 1024 | — | $0.10/1M tokens |
| `nomic-embed-text` (local) | 768 | 137M | Free (self-hosted) |
| `mxbai-embed-large` (local) | 1024 | 335M | Free (self-hosted) |

**Critical engineering fact:** More dimensions ≠ always better. `text-embedding-3-small` often outperforms older `text-embedding-ada-002` despite fewer dimensions because it was trained better, not bigger.

---

## 3. Similarity Search: The Math (Engineer's Version)

You don't need to derive these. You need to know which one to use and why.

### Cosine Similarity
```
cos(θ) = (A · B) / (|A| × |B|)
Range: -1 to 1. 1 = identical direction, 0 = orthogonal, -1 = opposite.
```
**Use when:** Comparing meaning direction, not magnitude. Standard for text embeddings.
**After L2 normalization:** cosine similarity == dot product (same thing, cheaper to compute).

### Euclidean Distance (L2)
```
d = sqrt(Σ(Aᵢ - Bᵢ)²)
Range: 0 to ∞. 0 = identical.
```
**Use when:** Magnitude matters. Rare for text; more common for image embeddings.

### Dot Product
```
A · B = Σ(Aᵢ × Bᵢ)
```
**Use when:** Vectors are already L2-normalized (then equals cosine). Fastest to compute.

**Rule:** Stick to cosine similarity (or dot product on normalized vectors) for text. Don't overthink it.

---

## 4. The Indexing Problem: Why Brute Force Fails

If you have 1 million documents, each with 1536 dimensions, brute-force similarity search means:
```
1,000,000 vectors × 1,536 floats × 4 bytes = ~6 GB of memory
1,000,000 dot products per query = millions of floating point operations
```

At scale this is too slow for real-time search. The solution: **Approximate Nearest Neighbor (ANN)** algorithms. They trade a small amount of accuracy for massive speed gains.

```
Exact search:       100% recall, O(n × d) time, too slow at >100k vectors
ANN algorithms:     ~95-99% recall, O(log n) or O(d × ef) time, production-viable
```

### HNSW (Hierarchical Navigable Small World)

The dominant algorithm in production vector DBs (Qdrant, Weaviate, pgvector with HNSW index, Pinecone).

**Mental model:** Imagine a multi-floor building. Each floor is a "graph" of neighbors. Top floors have few nodes but long connections (for fast coarse navigation). Bottom floors are dense with short-range connections (for precision).

```
         Floor 3 (sparse, long jumps):   A ──── E
                                         |
         Floor 2 (medium):       A ── C ── E ── G
                                         |
         Floor 1 (dense):    A─B─C─D─E─F─G─H─I
                                     ^
                          query enters here, navigates to nearest neighbor
```

To query:
1. Enter at top floor → coarse navigation to approximate region
2. Descend floors → increasingly fine-grained search
3. At bottom floor → compare exact neighbors, return top-k

**Key parameters you'll tune:**
- `m` (connections per node): higher = better recall, more memory
- `ef_construction` (build-time search width): higher = better index quality, slower build
- `ef` (query-time search width): higher = better recall, slower query
- Typical production values: `m=16`, `ef_construction=100`, `ef=64`

**Memory formula:** ~`(m × 8 bytes × n_vectors)` + raw vector storage. Plan for 2-5× the raw float storage.

---

## 5. Chunking: The Most Underestimated Engineering Decision

Before you can embed documents, you must split them. This is called **chunking**, and it's where most RAG systems fail silently.

**Why chunking matters:** Embedding models have token limits (usually 512-8192 tokens). More critically, embedding quality degrades for very long texts — the single vector must represent everything, so specifics get "averaged out."

```
Long document (10,000 tokens)
    One embedding tries to represent everything
    Query about one specific section → weak match
    
Chunked document (20 chunks × 500 tokens)
    20 embeddings, each representing one section
    Query about one section → strong match on the right chunk
```

### Chunking Strategies

**Fixed-size chunking**
```python
chunk_size = 512    # tokens
chunk_overlap = 50  # tokens overlap between consecutive chunks
```
- Simplest. Cuts mid-sentence, mid-thought.
- Good for: homogeneous text (transcripts, logs)
- Bad for: structured documents (code, markdown, PDFs with sections)

**Recursive character splitting (LangChain default)**
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", " ", ""]  # tries these in order
)
```
- Tries to split on paragraph → line → word → character
- Respects natural text boundaries better than fixed-size
- Still ignores semantic meaning

**Semantic chunking**
- Embed every sentence, then group sentences whose embeddings are "similar"
- Split when cosine similarity drops sharply between adjacent sentences
- Better quality, ~5× more expensive (must embed every sentence first)
- Use for: high-value document indexing where retrieval quality matters most

**Document-structure-aware chunking**
- Parse markdown headers → split on `##`, `###`
- Parse code → split on function/class boundaries
- Parse HTML → split on semantic tags
- Best recall for structured documents

**The production rule:** Start with recursive character splitting at 500-1000 tokens, 10-20% overlap. Measure retrieval quality. Only switch to semantic chunking if retrieval is the bottleneck.

---

## 6. Vector Database Architecture

A vector DB is not just "a database that stores vectors." It combines:

```
┌─────────────────────────────────────────────────────────────┐
│                      Vector Database                        │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │   Storage    │   │  ANN Index   │   │  Metadata    │   │
│  │  (raw vectors│   │  (HNSW,      │   │  Filter      │   │
│  │  + payload)  │   │  IVF, etc.)  │   │  (pre/post)  │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Query Engine                            │  │
│  │  1. Embed query (done by caller, not DB)             │  │
│  │  2. ANN search → candidate set                       │  │
│  │  3. Apply metadata filters                           │  │
│  │  4. Optional: re-rank by exact cosine                │  │
│  │  5. Return top-k results with scores + payloads      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** The vector DB does NOT embed your query. You must call the embedding model, get the vector, then query the DB. This is two network round trips.

### Metadata Filtering

Every production vector DB supports filtering on structured metadata alongside vectors:

```python
# Qdrant example: semantic search + metadata filter
results = client.search(
    collection_name="docs",
    query_vector=query_embedding,     # the actual ANN search
    query_filter=Filter(              # applied DURING search, not after
        must=[
            FieldCondition(key="tenant_id", match=MatchValue(value="acme")),
            FieldCondition(key="doc_type", match=MatchValue(value="policy")),
        ]
    ),
    limit=5
)
```

**Pre-filtering vs. Post-filtering:**
- **Pre-filter:** Filter candidates before ANN search. Fast but can hurt recall if filter is very restrictive.
- **Post-filter:** ANN search first, then filter results. May return fewer than k results.
- Qdrant and Weaviate do smart hybrid: they adapt based on filter selectivity. Pinecone does post-filter.

---

## 7. Vector DB Comparison

| DB | Hosting | Best for | Weakness |
|----|---------|----------|----------|
| **Pinecone** | Managed only | Quickest to production | Expensive at scale, vendor lock-in |
| **Qdrant** | Self-host or cloud | Best OSS option, rich filtering | Operational overhead if self-hosted |
| **Weaviate** | Self-host or cloud | Multi-modal (text + images) | Complex config |
| **Chroma** | Self-host (local) | Local dev, prototyping | Not production-grade at scale |
| **pgvector** | Postgres extension | Already using Postgres | HNSW recall lags specialized DBs |
| **Milvus** | Self-host | High-scale (billions of vectors) | Operational complexity |

**Practical starting point for a production system:**
- Prototype locally → **Chroma** or **Qdrant** (local mode)
- Production (managed) → **Pinecone** (simplest) or **Qdrant Cloud** (better price/performance)
- Already on Postgres → **pgvector** (zero extra infra, good enough for <1M vectors)

---

## 8. The Embedding Pipeline in Production

```
User uploads document
         │
         ▼
┌─────────────────┐
│  Document       │ ← load PDF/Word/HTML
│  Loader         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Splitter  │ ← chunk into 500-1000 token pieces
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Embedding      │ ← batch API call (100-2000 chunks per request)
│  Model          │   OpenAI: max 2048 inputs per batch
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Store   │ ← upsert vectors + metadata
│  (Qdrant/etc.)  │
└─────────────────┘

Query time:
User query → embed query → ANN search → top-k chunks → stuff into prompt → LLM
```

**Production cost calculation example:**
- 1000 documents, average 5000 tokens each
- Chunked at 500 tokens: ~10 chunks/doc → 10,000 chunks
- Embedding all with `text-embedding-3-small`: 10,000 × 500 = 5M tokens → **$0.10 total**
- Storage: 10,000 × 1536 floats × 4 bytes = ~60MB → negligible

Ingestion is cheap. Re-embedding entire corpus on model upgrade is the expensive part.

---

## 9. Common Engineering Mistakes

### Mistake 1: Using the wrong chunk size
- Too small (< 100 tokens): chunks lack context, semantically weak embeddings
- Too large (> 2000 tokens): embeddings too diluted, poor retrieval precision
- **Fix:** Test with 3-4 chunk sizes, measure retrieval precision/recall on sample queries

### Mistake 2: Not storing the source text alongside the vector
If you only store the vector and lose the original text, you can't reconstruct the answer.
```python
# Always upsert with payload:
client.upsert(collection_name="docs", points=[
    PointStruct(
        id=str(uuid4()),
        vector=embedding,
        payload={
            "text": chunk_text,      # ← REQUIRED: original text
            "source": "policy.pdf",
            "page": 4,
            "chunk_index": 7,
        }
    )
])
```

### Mistake 3: Embedding model mismatch
If you embed documents with model A and query with model B, the vector spaces are incompatible. Results will be garbage with no error thrown.

**Fix:** Store the embedding model name in collection metadata. If you upgrade the model, re-embed the entire corpus.

### Mistake 4: Not batching embedding calls
```python
# BAD: one API call per chunk
for chunk in chunks:
    embedding = embed(chunk)  # 10,000 API calls

# GOOD: batch in groups of 100-2000
for batch in chunks_batched(chunks, size=500):
    embeddings = embed_batch(batch)  # 20 API calls
```
Rate limits and latency make sequential embedding 50-100× slower than batched.

### Mistake 5: Semantic search alone for exact lookups
```
Query: "What is our refund policy for order #A12345?"

Semantic search returns: documents about refund policy (good)
But misses: the specific order number (exact match needed)

Solution: Hybrid search (Chapter 8 - Advanced RAG)
```

---

## 10. ASCII Architecture: Full Embedding + Query Pipeline

```
INGESTION PIPELINE
==================

Raw Docs (PDF, HTML, MD)
        │
        ▼
   [Document Loader]
        │  "Here is the full text of your document..."
        ▼
   [Text Splitter]  chunk_size=500, overlap=50
        │  ["chunk1...", "chunk2...", "chunk3..."]
        ▼
   [Embedding Model API]  ← batch call (up to 2000 chunks)
        │  [[0.12,-0.83,...], [0.44,0.07,...], ...]
        ▼
   [Vector Store Upsert]  ← vector + metadata payload
        │
   [Indexed & Searchable]


QUERY PIPELINE
==============

User Query: "How do I reset my password?"
        │
        ▼
   [Embedding Model API]  ← single embed call
        │  [0.14, -0.81, 0.42, ...]
        ▼
   [Vector Store ANN Search]
        │  top-5 similar chunks (cosine similarity > 0.7)
        ▼
   [Fetch chunk .text from payload]
        │  "To reset your password, go to Settings > Security..."
        ▼
   [Stuff into Prompt]
        │
        ▼
   [LLM]  → "You can reset your password by going to Settings..."
```

---

## 11. Interview Traps & Gotchas

### "Vector search always returns the most relevant results"
**Reality:** It returns what's *geometrically nearest* in the embedding space, which correlates with semantic similarity but is not guaranteed to be what the user needs. A document can be semantically close but factually useless. Embeddings encode surface-level meaning patterns from training data, not truth.

### "I can use one embedding model for queries and another for documents"
**Reality:** Hard error. Each model defines its own vector space geometry. Cosine similarity between vectors from different models is meaningless.

### "Bigger chunk size is always better for context"
**Reality:** Embedding quality degrades for long chunks. A 2000-token chunk has one vector representing many ideas — retrieval precision suffers. The winning chunk size is problem-specific and must be empirically tuned.

### "More dimensions = better recall"
**Reality:** Recall depends on model training quality and index parameters, not dimensionality alone. `text-embedding-3-small` (1536d) beats `text-embedding-ada-002` (1536d, but older training) on most benchmarks.
