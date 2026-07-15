# Chapter 7 — RAG Pipelines
## Document Loaders, Retrievers, Re-rankers, and the Full Engineering View

---

## 1. The Core Mental Model

RAG stands for **Retrieval-Augmented Generation**. But that name buries the key insight. Here's a better mental model:

> **RAG is a database lookup, not magic.**

An LLM has fixed training data and a fixed context window. It cannot know your private documents. RAG solves this by doing what any software engineer would do: **look it up first, then answer**.

```
WITHOUT RAG:
  User: "What is our SLA for enterprise customers?"
  LLM: "I don't have access to your specific SLA..." (or worse: hallucinates)

WITH RAG:
  1. Search your docs for "SLA enterprise customers"
  2. Retrieve: "Enterprise SLA: 99.9% uptime, 4-hour response time..."
  3. Inject into prompt
  4. LLM: "Your enterprise SLA guarantees 99.9% uptime with 4-hour response..."
```

The LLM becomes a **reasoning and language layer** on top of your retrieval system. The retrieval system is doing the real work of finding relevant facts.

**The uncomfortable truth:** Most RAG failures are retrieval failures, not LLM failures. If the right chunks don't make it into the context, no LLM will save you.

---

## 2. Naive RAG vs. Production RAG

Most tutorials show "naive RAG" — it works in a demo, breaks in production.

```
NAIVE RAG (tutorial-grade):
──────────────────────────
User query
    → embed query
    → top-k vector search
    → stuff chunks into prompt
    → LLM answer

PRODUCTION RAG (engineering-grade):
────────────────────────────────────
User query
    → [query understanding / rewriting]   ← often skipped, often breaks things
    → embed (rewritten) query
    → [hybrid retrieval: vector + keyword] ← pure vector search misses exact terms
    → [metadata filtering]                 ← tenant isolation, doc type, date range
    → [re-ranking]                         ← vector score ≠ true relevance
    → [context compression / selection]    ← not all retrieved chunks are useful
    → [prompt assembly with citations]     ← structure matters for grounding
    → LLM answer
    → [answer grounding check]             ← did the LLM use the retrieved content?
```

You won't implement all of these in every system. But you need to know each piece exists, what it costs, and when to add it.

---

## 3. The Full RAG Architecture

```
                         INGESTION (offline)
                         ═══════════════════
Raw Sources (PDF, HTML, DB, API)
         │
         ▼
   [Document Loaders]          ← format-specific parsers
         │ raw text + metadata
         ▼
   [Text Splitters]            ← chunking (Ch. 6 strategies)
         │ chunks[]
         ▼
   [Embedding Model]           ← batch embed (OpenAI, local)
         │ vectors[]
         ▼
   [Vector Store]              ← store vectors + payloads
         │
   [Keyword Index]             ← BM25 / Elasticsearch (optional)
         │
         ▼
   [Index Ready]


                         QUERY (real-time, per request)
                         ══════════════════════════════
User Query
    │
    ▼
[Query Transform]              ← optional: rewrite, expand, decompose
    │ transformed query(ies)
    ▼
[Retriever]
    ├─ [Vector Search]         ← semantic similarity (HNSW ANN)
    └─ [BM25 / Keyword Search] ← exact term match
    │ candidates (top-20 to top-50)
    ▼
[Re-ranker]                    ← cross-encoder model rescores top candidates
    │ top-k (5-10)
    ▼
[Context Assembler]            ← format chunks into prompt
    │ prompt string
    ▼
[LLM]
    │ response
    ▼
[Response]  (+ optional citations, grounding check)
```

---

## 4. Document Loaders

A document loader converts a raw source (file, URL, database row) into a structured `Document` object: `{page_content: str, metadata: dict}`.

LangChain has 100+ loaders. But they're all thin wrappers. Know the patterns, not the list.

### What loaders actually do

```python
from langchain_community.document_loaders import (
    TextLoader,           # plain .txt files
    PyPDFLoader,          # PDF via pypdf
    UnstructuredHTMLLoader,  # HTML via Unstructured
    JSONLoader,           # JSON with jq selector
    WebBaseLoader,        # HTTP fetch + parse
    DirectoryLoader,      # wraps any loader for all files in a dir
)

# All loaders share the same interface:
loader = PyPDFLoader("policy.pdf")
docs = loader.load()           # returns List[Document]
# doc.page_content = text
# doc.metadata = {"source": "policy.pdf", "page": 3}
```

### The metadata problem

Loaders give you `source` and `page` by default. Production systems need more:

```python
# Always enrich metadata at load time — you can't recover it later
doc.metadata.update({
    "tenant_id": "acme",
    "doc_type": "policy",
    "ingested_at": datetime.utcnow().isoformat(),
    "version": "2024-01",
})
```

**Engineering mistake:** Not adding tenant_id at ingestion time. Later you want multi-tenant filtering. Now you must re-ingest everything.

### PDF loading is not solved

PDFs are not structured text. They're rendered pages. Extractors vary wildly:

| Extractor | Good for | Breaks on |
|-----------|----------|-----------|
| `pypdf` | Simple text PDFs | Scanned PDFs, multi-column layouts |
| `pdfminer` | Better text extraction | Slow, still fails on complex layouts |
| `unstructured` | Tables, headers, multi-column | Slow, requires extra deps |
| `llamaparse` | Best quality (LLM-powered) | Expensive (~$0.003/page), slow |

**Production rule:** For text-heavy PDFs, `pypdf` is fine. For complex PDFs (invoices, tables, forms), budget for `unstructured` or `llamaparse`.

---

## 5. Retrievers: The Engineering Reality

A retriever is just a function: `query_str → List[Document]`. Everything else is abstraction.

### Basic Vector Retriever

```python
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

vectorstore = QdrantVectorStore(
    client=client,
    collection_name="docs",
    embedding=embeddings,
)

retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5}
)

docs = retriever.invoke("how do I reset my password?")
# Internally: embed query → ANN search → return top-5 Document objects
```

### What `retriever.invoke()` actually does

```
1. embeddings.embed_query("how do I reset my password?")
   → POST api.openai.com/v1/embeddings
   → [0.14, -0.81, 0.42, ...]

2. qdrant_client.search(collection="docs", query=[0.14, -0.81, ...], limit=5)
   → HNSW traversal
   → [ScoredPoint(id=..., score=0.87, payload={text: "...", source: "..."}), ...]

3. Convert ScoredPoints → List[Document]
   → [Document(page_content="...", metadata={source: "...", score: 0.87})]
```

Two network round trips on every query. This is your retrieval latency baseline.

### MMR: Maximum Marginal Relevance

A critical improvement over simple top-k:

**Problem with top-k:** If you have 3 very similar chunks, top-5 returns all 3 + 2 others. You waste context window on redundant content.

**MMR solution:** Balance relevance (similar to query) *and* diversity (dissimilar to already-selected chunks):

```python
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 5,           # final number of chunks to return
        "fetch_k": 20,    # candidates to consider before MMR selection
        "lambda_mult": 0.5  # 0 = max diversity, 1 = max relevance
    }
)
```

**Internally:**
1. Fetch top-20 candidates by cosine similarity
2. Select 5, one at a time, each time choosing the one that is:
   - Most similar to the query, AND
   - Most dissimilar to already-selected chunks

This is a greedy approximation but works well in practice.

---

## 6. Re-Ranking: Why Vector Scores Lie

This is the most misunderstood part of RAG.

**The problem:** ANN vector search returns documents that are *geometrically close* in embedding space. But geometric closeness in 1536-d space ≠ "most useful for answering this query."

```
Query: "What is the cancellation policy for monthly subscribers?"

Vector search returns (cosine similarity):
  Rank 1 (0.89): "Subscribers can cancel at any time. Monthly plans renew..."  ← GOOD
  Rank 2 (0.86): "We offer monthly, annual, and lifetime subscription plans..."  ← IRRELEVANT
  Rank 3 (0.84): "Your subscription will be cancelled effective at end of..."   ← GOOD
  Rank 4 (0.83): "For subscription management, visit account settings..."       ← MEDIOCRE
  Rank 5 (0.82): "Monthly subscribers receive priority support..."              ← IRRELEVANT
```

The vector score ranking is noisy. A re-ranker fixes this.

### Cross-Encoder Re-Ranker

A **cross-encoder** takes `(query, document)` as a *single input* (not separate embeddings). It runs full attention across both, producing a much more accurate relevance score.

```
Bi-encoder (embeddings):                Cross-encoder (re-ranker):
────────────────────────                 ──────────────────────────
embed(query) = [...]    ← separate       [query + doc] → single model → score
embed(doc) = [...]
cosine(q, d) = 0.87     ← fast but noisy                            ← slow but accurate

Cost: O(1) per query                    Cost: O(k) per query (k = candidate count)
Use for: first-pass ANN retrieval       Use for: rescoring top candidates
```

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore

# Base retriever: fast vector search, returns top-20 candidates
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 20})

# Re-ranker: cross-encoder rescores top-20, returns top-5
reranker = CohereRerank(model="rerank-english-v3.0", top_n=5)

compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=base_retriever,
)

# This runs: vector search (top-20) → Cohere rerank → return top-5
docs = compression_retriever.invoke("cancellation policy for monthly subscribers")
```

### Re-Ranker Cost/Latency Tradeoff

| Re-ranker | Latency | Cost | Quality |
|-----------|---------|------|---------|
| None | 0ms extra | $0 | Vector score (noisy) |
| Cohere rerank-v3 | ~200-400ms | $0.001/1k searches | Best managed option |
| `bge-reranker-v2` (local) | ~100ms (GPU) / ~500ms (CPU) | Infrastructure cost | Comparable to Cohere |
| `ms-marco-MiniLM` (local) | ~50ms (GPU) | Infrastructure cost | Good for English |

**Rule:** Use re-ranking when retrieval quality is your bottleneck. Skip it when p95 latency matters more than recall precision. Always fetch 3-4× more candidates than you return (e.g., fetch 20, rerank to 5).

---

## 7. Context Assembly: The Forgotten Step

After retrieval and re-ranking, you have 5-10 chunks. How you assemble them into a prompt matters more than most engineers realize.

### The Naive Approach (what everyone does first)

```python
context = "\n\n".join([doc.page_content for doc in docs])
prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
```

**Problems:**
1. No source attribution → LLM can't cite which document
2. No chunk ordering signal → LLM doesn't know which is more relevant
3. LLM attention on relevant chunk is diluted by irrelevant surrounding text

### Production Context Assembly

```python
def assemble_context(docs: list[Document], query: str) -> str:
    """
    Structure context for maximum LLM grounding.
    Chunks are numbered and sourced — the LLM can cite them.
    Most relevant chunk (rank 1) goes last due to "lost in the middle" effect.
    """
    # Reverse order: put most relevant chunk LAST (LLMs attend more to recent content)
    ordered_docs = list(reversed(docs))

    context_parts = []
    for i, doc in enumerate(ordered_docs, 1):
        source = doc.metadata.get("source", "unknown")
        page = doc.metadata.get("page", "")
        location = f"{source}, p.{page}" if page else source
        context_parts.append(
            f"[Source {i}: {location}]\n{doc.page_content}"
        )

    return "\n\n---\n\n".join(context_parts)
```

### The "Lost in the Middle" Problem

Research finding (Liu et al., 2023): **LLMs perform best when relevant information is at the beginning or end of the context. Accuracy drops significantly for information in the middle.**

```
Context with 10 chunks:
[Chunk 1] ← LLM attends well
[Chunk 2] ← OK
[Chunk 3] ← Fading
[Chunk 4] ← POOR (middle)
[Chunk 5] ← POOR (middle)
[Chunk 6] ← POOR (middle)
[Chunk 7] ← Getting better
[Chunk 8] ← OK
[Chunk 9] ← Good
[Chunk 10] ← LLM attends well
```

**Engineering implication:** Put your most relevant chunks first or last. The standard trick: place re-ranked rank-1 last in the context string (LLMs weight recent context more).

---

## 8. The Full RAG Chain in LangChain LCEL

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from qdrant_client import QdrantClient

# Setup
client = QdrantClient(url="http://localhost:6333")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = QdrantVectorStore(client=client, collection_name="docs", embedding=embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# Prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant. Answer the question using ONLY the provided context.
If the answer is not in the context, say "I don't have information about that."
Do not make up information.

Context:
{context}"""),
    ("human", "{question}"),
])

def format_docs(docs):
    return "\n\n---\n\n".join(
        f"[Source: {doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    )

# LCEL chain: retriever runs in parallel with question passthrough
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# Invoke
answer = rag_chain.invoke("What is the cancellation policy?")
print(answer)
```

### What happens under the hood when you call `rag_chain.invoke()`:

```
1. RunnableParallel executes:
   a. retriever.invoke("What is the cancellation policy?")
      → embed query (OpenAI API call)
      → ANN search (Qdrant)
      → List[Document]
   b. RunnablePassthrough() → "What is the cancellation policy?" (unchanged)

2. format_docs(docs) → formatted context string

3. prompt.invoke({context: "...", question: "..."}) → ChatPromptValue

4. llm.invoke(prompt) → AIMessage (OpenAI API call)

5. StrOutputParser().invoke(message) → str
```

Two external API calls: embed query + LLM. Everything else is local computation.

---

## 9. Streaming RAG

For production UIs, you must stream LLM output. Users hate waiting 3-5 seconds for a full response.

```python
# Streaming version — same chain, use .stream() instead of .invoke()
async def stream_rag(query: str):
    async for chunk in rag_chain.astream(query):
        yield chunk  # yield each token as it arrives

# FastAPI endpoint example
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.get("/chat")
async def chat(q: str):
    async def generate():
        async for token in rag_chain.astream(q):
            yield f"data: {token}\n\n"  # SSE format
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Engineering note:** Retrieval is NOT streamed — it completes before LLM starts. The perceived latency from user's perspective is: `embed_time + retrieval_time + time_to_first_token`. Streaming only helps after the first token arrives.

---

## 10. Production Failure Modes

### Failure 1: Retrieval returns nothing useful

**Symptom:** LLM says "I don't have information about that" even though the answer is in your docs.

**Causes:**
- Query and document use different vocabulary ("cancel subscription" vs. "terminate plan")
- Chunk size too large — relevant sentence is buried in a chunk with many unrelated topics
- Embeddings indexed with wrong model

**Fixes:** Query rewriting (Chapter 8), hybrid search (BM25 + vector), smaller chunks with overlap

### Failure 2: LLM ignores retrieved context

**Symptom:** LLM answers from training data instead of provided context, sometimes hallucinating.

**Causes:**
- System prompt doesn't strongly instruct "use ONLY the context"
- Context is too long (LLM loses focus on middle chunks)
- LLM is "confident" from training data on the topic

**Fixes:** Stronger system prompt, reduce context to top-3 highly relevant chunks, use grounding check

### Failure 3: Answer contains info from wrong tenant

**Symptom:** Acme Corp sees Initech's data in answers.

**Cause:** Tenant metadata filtering not applied at query time.

**Fix:** Always filter by `tenant_id` at retrieval. This is a security issue, not a quality issue.

```python
# NEVER do this in multi-tenant systems:
docs = retriever.invoke(query)

# ALWAYS do this:
docs = vectorstore.similarity_search(
    query,
    filter={"tenant_id": current_user.tenant_id},  # Qdrant filter
    k=5
)
```

### Failure 4: Index out of date

**Symptom:** Users ask about a policy that changed last week; RAG returns the old version.

**Fix:** Implement document versioning and update pipeline. When a document changes:
1. Delete old vectors (by source filename metadata)
2. Re-chunk and re-embed new document
3. Upsert new vectors

```python
# Incremental update — delete old, insert new
client.delete(
    collection_name="docs",
    points_selector=Filter(
        must=[FieldCondition(key="source", match=MatchValue(value="policy.pdf"))]
    )
)
# Then re-ingest policy.pdf
```

### Failure 5: Context window overflow

**Symptom:** `ContextLengthExceededError` or silent truncation.

**Cause:** Retrieved chunks × chunk_size > model's context window.

```
GPT-4o:     128k tokens context
GPT-4o-mini: 128k tokens context
Claude 3.5 Sonnet: 200k tokens context

But cost: 128k context at GPT-4o prices = very expensive

Practical rule: keep prompt under 8k-16k tokens for cost/quality balance.
With 500-token chunks, that's 10-20 chunks maximum.
```

**Fix:** Cap `k` at a sensible number. Use re-ranking to ensure top-5 are the best 5, not top-20 stuffed in.

---

## 11. Latency Budget for a Production RAG Request

A realistic breakdown for a p50 request:

```
User query arrives
    │
    ├─ Query embedding (OpenAI)       ~80-120ms
    │
    ├─ Vector search (Qdrant cloud)   ~20-50ms
    │
    ├─ (Optional) Re-ranking          ~200-400ms  ← Cohere API
    │
    ├─ Prompt assembly                ~1ms        ← string concat
    │
    ├─ LLM (GPT-4o-mini)
    │   ├─ Time to first token        ~400-800ms
    │   └─ Full response (streaming)  ~1-3s       ← user sees tokens
    │
    └─ Total TTFT (streaming)         ~700-1500ms
       Total non-streaming            ~2-4s
```

With re-ranking: add 200-400ms. Without streaming: add full generation time.

**Optimization order (by impact):**
1. Enable streaming (biggest perceived improvement)
2. Use `gpt-4o-mini` not `gpt-4o` for non-complex queries (3× faster, 10× cheaper)
3. Cache embeddings for identical queries (Redis + hash)
4. Self-host embedding model (eliminates embedding network round trip)
5. Self-host re-ranker (eliminates re-rank network round trip)

---

## 12. RAG Evaluation: How Do You Know It's Working?

This is where most teams fail. "It seems to work" is not an evaluation strategy.

### The Three Metrics You Must Track

```
Retrieval metrics:
  Context Recall     = what fraction of the answer's facts appear in retrieved chunks?
  Context Precision  = what fraction of retrieved chunks are actually relevant?

Generation metrics:
  Answer Faithfulness = is the answer grounded in the retrieved context?
                        (did the LLM make things up?)
  Answer Relevancy    = does the answer actually address the question?
```

### Automated Evaluation with RAGAS

```python
from ragas import evaluate
from ragas.metrics import (
    context_recall,
    context_precision,
    faithfulness,
    answer_relevancy,
)
from datasets import Dataset

# You need: questions, ground truth answers, retrieved contexts, generated answers
eval_data = {
    "question": ["What is the cancellation policy?"],
    "answer": ["You can cancel anytime from account settings..."],  # LLM answer
    "contexts": [["Cancel at any time...", "Subscriptions renew monthly..."]],  # retrieved chunks
    "ground_truth": ["Monthly subscribers can cancel at any time."],  # known correct answer
}

result = evaluate(
    Dataset.from_dict(eval_data),
    metrics=[context_recall, context_precision, faithfulness, answer_relevancy],
)
print(result)
# {'context_recall': 0.95, 'context_precision': 0.72, 'faithfulness': 0.88, ...}
```

**Practical evaluation setup:**
1. Create a test set of 50-100 question + ground truth pairs from your domain
2. Run your RAG pipeline on all questions
3. Score with RAGAS or LLM-as-judge (gpt-4 evaluating gpt-4o-mini output)
4. Track scores across pipeline changes as your regression test

---

## 13. Common Engineering Mistakes

### Mistake 1: Using `k=3` everywhere
Three chunks is often too few. A complex question may need context from 5-8 different chunks. A simple factual question may only need 1. The right `k` is query-dependent — fixed `k` is a compromise that's rarely optimal. Use re-ranking with larger candidate set to compensate.

### Mistake 2: Not handling "no relevant chunks"
```python
docs = retriever.invoke(query)
if not docs or max(doc.metadata.get("score", 0) for doc in docs) < 0.6:
    return "I don't have relevant information about that in my knowledge base."
# Don't send irrelevant chunks to the LLM — it will hallucinate to fill the gap
```

### Mistake 3: Trusting LLM to say "I don't know"
LLMs are trained to be helpful. They will often answer confidently from training data when the retrieved context doesn't contain the answer — *even if you tell them not to*. Use score thresholds or faithfulness checks, not just prompt instructions.

### Mistake 4: Ignoring the ingestion pipeline as production code
Most teams build ingestion as a one-time script. In production it needs: error handling, idempotency (re-running doesn't create duplicates), progress tracking, cost monitoring (each embed call costs money), and update detection.

### Mistake 5: Storing full document text in vector payload
For large documents, storing the full text in the vector DB payload bloats storage and slows down fetches. Better pattern: store chunk text + a reference to the original document store (S3, PostgreSQL). Only store what you need for the prompt.

---

## 14. ASCII Architecture: Production RAG System

```
                          ┌─────────────────────────────────────┐
                          │          INGESTION PIPELINE          │
                          │          (runs offline/async)        │
                          └─────────────────────────────────────┘
                                           │
  Document Sources                         │
  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
  │  PDF/DOC │ │   HTML   │ │   DB     │  │
  └────┬─────┘ └────┬─────┘ └────┬─────┘  │
       └────────────┴────────────┘         │
                    │                      │
                    ▼                      │
          ┌──────────────────┐             │
          │  Document Loader │             │
          │  + Metadata tag  │             │
          │  (tenant, type,  │             │
          │   version, date) │             │
          └────────┬─────────┘             │
                   │                       │
                   ▼                       │
          ┌──────────────────┐             │
          │   Text Splitter  │             │
          │   (recursive,    │             │
          │    chunk=500,    │             │
          │    overlap=50)   │             │
          └────────┬─────────┘             │
                   │                       │
                   ▼                       │
          ┌──────────────────┐             │
          │  Embedding Model │             │
          │  (batched, 500   │             │
          │   chunks/call)   │             │
          └────────┬─────────┘             │
                   │                       │
          ┌────────▼─────────┐   ┌─────────┴──────────┐
          │   Vector Store   │   │   Keyword Index     │
          │   (Qdrant)       │   │   (BM25/Elastic)    │
          └──────────────────┘   └────────────────────┘


                          ┌─────────────────────────────────────┐
                          │            QUERY PIPELINE            │
                          │            (real-time, ~1s)          │
                          └─────────────────────────────────────┘

User Query "what's the cancellation policy?"
         │
         ▼
  ┌──────────────┐
  │ Query embed  │  (OpenAI ~100ms)
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────┐
  │            Hybrid Retriever              │
  │  ┌──────────────┐   ┌──────────────────┐ │
  │  │ Vector Search│ + │  BM25 Search     │ │  top-20 candidates
  │  │ (semantic)   │   │  (keyword exact) │ │
  │  └──────────────┘   └──────────────────┘ │
  └──────────────────────┬───────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │  Re-Ranker    │  cross-encoder, top-20 → top-5
                 │  (Cohere API  │  (~300ms)
                 │   or local)   │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Score filter  │  drop chunks < 0.5 relevance
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │    Prompt     │  assemble context + system instructions
                 │   Assembly    │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │  LLM (stream) │  GPT-4o-mini, temperature=0
                 └───────┬───────┘
                         │
                         ▼
                    Answer + Citations
```

---

## 15. Interview Traps & Gotchas

### "RAG guarantees accurate answers"
**Reality:** RAG reduces hallucination but does not eliminate it. If the retrieved chunks don't contain the answer, the LLM may hallucinate to fill the gap. If the chunks are wrong (outdated documents), the LLM will confidently give wrong answers based on them. RAG quality is bounded by retrieval quality.

### "Just increase k to get better answers"
**Reality:** More chunks = larger context = higher cost, more latency, and the "lost in the middle" problem. Better strategy: re-ranking. Fetch 20, rerank to 5 high-quality chunks rather than stuffing 15 mediocre ones.

### "Temperature=0 makes LLM deterministic in RAG"
**Reality:** Temperature=0 is the closest to deterministic, but not guaranteed on all models/providers. Caching LLM responses is not trivially safe because identical prompts with identical context can still get different outputs. For RAG, temperature=0 is correct to reduce creative deviation from context.

### "I can share one vector collection across all tenants"
**Reality:** You can, but ONLY if you always filter by `tenant_id` at query time. A missing filter in one code path leaks all tenants' data. Many teams use separate collections per tenant to make isolation structurally impossible to bypass.
