# Chapter 8 — Advanced RAG
## Hybrid Search, Query Rewriting, Self-RAG, and Multi-Hop Retrieval

---

## 1. The Core Mental Model

Chapter 7 gave you a working RAG pipeline. This chapter answers one question:

> **Why does basic RAG still fail, and what are the engineering solutions?**

Basic RAG has four fundamental weaknesses:

```
Weakness 1: Vocabulary mismatch
  User says "cancel subscription" → docs say "terminate plan"
  Semantic embeddings partially solve this, but not for exact product names,
  error codes, version numbers, or domain-specific jargon.

Weakness 2: Query ambiguity
  "How do I fix this?" → fix what? In what context?
  The embedding of a vague query retrieves vague chunks.

Weakness 3: Single-hop retrieval
  Some questions need facts from multiple documents combined:
  "What are the pricing differences between our Pro and Enterprise plans for EU customers?"
  No single chunk answers this. You need: chunk(Pro pricing) + chunk(Enterprise pricing)
  + chunk(EU-specific terms). Basic RAG fetches k chunks from one search — not enough.

Weakness 4: No feedback loop
  Basic RAG blindly trusts retrieval. If retrieval returns garbage, LLM gets garbage.
  There's no mechanism to detect failure and try again.
```

Each advanced technique in this chapter targets one or more of these weaknesses.

---

## 2. Hybrid Search: Solving Vocabulary Mismatch

### The Problem

Dense vector search (bi-encoder embeddings) finds semantically similar content well. But it fails on:
- **Exact product names**: "GPT-4o-mini" vs "small model"
- **Error codes**: "ERR_CONNECTION_REFUSED" — no semantic neighborhood
- **Version numbers**: "v2.1.3" — embedding won't link to "2.1.3 release notes"
- **Rare terminology**: proper nouns, internal codenames, abbreviations

BM25 (sparse keyword search) is the opposite: it excels at exact term matching but is terrible at semantics.

```
Query: "How do I handle token limits in the API?"

BM25 finds:       "token limit exceeded error" (exact term match: "token")
Vector finds:     "managing API rate constraints and quota errors" (semantic match)

The best answer might need BOTH.
```

### BM25 Internals (What You Need to Know)

BM25 scores a document for a query based on:
1. **Term frequency** (TF): how often query terms appear in the doc
2. **Inverse document frequency** (IDF): rare terms score higher than common ones
3. **Document length normalization**: penalizes very long documents

```
BM25(d, q) = Σ IDF(t) * (TF(t,d) * (k1+1)) / (TF(t,d) + k1 * (1 - b + b * |d|/avgdl))

Where:
  k1 = term frequency saturation (default 1.5) — prevents one repeated term dominating
  b  = length normalization (default 0.75)
  avgdl = average document length in corpus
```

You don't implement BM25 from scratch — you use a library. But understanding it tells you:
- **It's purely term-based**: no understanding of meaning whatsoever
- **IDF makes rare words powerful**: "Qdrant" scores higher than "the"
- **It's very fast**: no embedding needed, pure inverted index lookup

### Reciprocal Rank Fusion (RRF): How to Combine Scores

BM25 scores and vector cosine scores are **not on the same scale**. You can't average them.

RRF solves this elegantly: instead of combining raw scores, combine **ranks**.

```
RRF(d) = Σ 1 / (k + rank_in_source(d))

Where k = 60 (smoothing constant, empirically tuned)

Example:
  Doc A: vector rank 1, BM25 rank 3
    RRF = 1/(60+1) + 1/(60+3) = 0.01639 + 0.01587 = 0.03226

  Doc B: vector rank 2, BM25 rank 1
    RRF = 1/(60+2) + 1/(60+1) = 0.01613 + 0.01639 = 0.03252 ← higher

  Doc C: vector rank 1, BM25 rank 100 (not found)
    RRF = 1/(60+1) + 1/(60+100) = 0.01639 + 0.00625 = 0.02264 ← lower than both
```

RRF rewards documents that **consistently rank well across both systems**. A document that appears at rank 1 in only one system loses to a document that appears in the top 5 of both.

### Implementation: Hybrid Search in LangChain + Qdrant

```python
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient

# Setup vector store
client = QdrantClient(url="http://localhost:6333")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = QdrantVectorStore(client=client, collection_name="docs", embedding=embeddings)

# Vector retriever: semantic search
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

# BM25 retriever: exact keyword search (in-memory, no external service needed)
# Requires your documents to be available as a Python list at startup
bm25_retriever = BM25Retriever.from_documents(all_docs)  # List[Document]
bm25_retriever.k = 10

# Ensemble retriever: combines with RRF
ensemble_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    weights=[0.6, 0.4]  # vector gets 60% weight in RRF — tune based on your domain
)

docs = ensemble_retriever.invoke("GPT-4o-mini token limit")
# Internally:
#   1. vector_retriever returns top-10 by cosine similarity
#   2. bm25_retriever returns top-10 by BM25 score
#   3. EnsembleRetriever applies RRF and returns merged, re-ranked top-k
```

### What the `weights` parameter actually does

Counterintuitively, `weights` in `EnsembleRetriever` are **not applied to raw scores** — they're applied to the RRF contribution from each source:

```python
# Each retriever's rank contribution is scaled by its weight:
rrf_score(d) = Σ (weight_i / (k + rank_i(d)))

# With weights=[0.6, 0.4]:
rrf_score(d) = 0.6/(60 + vector_rank) + 0.4/(60 + bm25_rank)

# This means: same rank in vector search contributes 1.5x more than BM25
# Tune this based on: how often exact term matching matters vs semantic matching
```

### BM25 in Production: The In-Memory Problem

`BM25Retriever.from_documents(all_docs)` loads everything into memory at startup. This is a problem:

```
At 1,000 docs: fine
At 100,000 docs: ~2-4GB RAM, slow startup, single process only

Production solutions:
  Option 1: Elasticsearch / OpenSearch   → BM25 at scale, distributed
  Option 2: Qdrant sparse vectors        → BM25-equivalent via SPLADE inside the vector DB
  Option 3: Typesense / Meilisearch      → lighter search servers with BM25
```

For serious production use, use **Qdrant's sparse vectors** (SPLADE model) to keep everything in one system:

```python
# Qdrant supports sparse + dense vectors in the same collection (hybrid search natively)
# Sparse vectors ≈ learned BM25 (via SPLADE encoder)
# This avoids running a separate keyword search service

from qdrant_client.models import SparseVectorParams, VectorParams, Distance

client.create_collection(
    collection_name="hybrid_docs",
    vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)},
    sparse_vectors_config={"sparse": SparseVectorParams()}
)
# Then upsert both dense (text-embedding-3-small) and sparse (SPLADE) vectors per chunk
```

---

## 3. Query Rewriting: Solving Query Ambiguity

### The Problem

User queries are often:
- **Too vague**: "how does it work?" — work like what?
- **Too conversational**: "what about the pricing for that thing I mentioned?"
- **Sub-optimal for retrieval**: "Can you tell me about authentication?" → the word "authentication" doesn't appear in your docs which say "login" and "access control"
- **Multi-part**: "What's the refund policy, and do I need to contact support for it?" — two questions, one retrieval

The embedding of the raw user query is not always the best retrieval key.

### Technique 1: HyDE — Hypothetical Document Embeddings

**The idea:** Instead of embedding the query, generate a *hypothetical answer* and embed that.

Why? Because good answers live in the same embedding neighborhood as the actual documents — much closer than the question itself.

```
Query embedding space:
  "What is the cancellation policy?"  →  embeds near: questions, FAQ titles

Document embedding space:
  "You can cancel your subscription at any time..."  →  embeds near: policy documents

HyDE bridges this gap:
  1. Ask LLM: "Write a plausible answer to: What is the cancellation policy?"
  2. LLM returns: "Customers can cancel their subscription at any time by..."
  3. Embed THAT text
  4. Use that embedding to search the vector store
  → Now your query embedding is in the "answer" space, not the "question" space
```

```python
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Step 1: Generate hypothetical document
hyde_prompt = ChatPromptTemplate.from_template(
    """Write a concise, factual paragraph that directly answers the following question.
Write as if you are a knowledgeable assistant with access to relevant documentation.
Do not acknowledge uncertainty — write a plausible, specific answer.

Question: {question}

Answer:"""
)

hypothetical_doc_chain = hyde_prompt | llm | StrOutputParser()

# Step 2: Embed the hypothetical doc and search
def hyde_retriever(query: str, vectorstore: QdrantVectorStore, k: int = 5):
    # Generate hypothetical answer
    hypothetical_doc = hypothetical_doc_chain.invoke({"question": query})

    # Embed the hypothetical doc (not the query!)
    doc_embedding = embeddings.embed_query(hypothetical_doc)

    # Search with the hypothetical doc's embedding
    results = vectorstore.similarity_search_by_vector(doc_embedding, k=k)

    return results

# Usage
docs = hyde_retriever("What is the cancellation policy for monthly subscribers?")
```

**Under the hood:**
- Two LLM calls per request: one for HyDE generation, one for final answer
- HyDE adds ~100-300ms latency (gpt-4o-mini call)
- Works best when query-document vocabulary mismatch is the bottleneck

**When HyDE fails:**
- When the hypothetical doc contains wrong facts that embed toward wrong documents
- For highly specific factual queries where the LLM hallucinates a specific wrong answer
- When the extra LLM call cost/latency is not acceptable

### Technique 2: Multi-Query Retrieval

**The idea:** Generate multiple versions of the same query. Each version retrieves different documents. Union the results.

```
Original: "How to handle auth token expiry?"

Rewritten versions:
  1. "What happens when an authentication token expires?"
  2. "How to refresh expired JWT tokens in the API?"
  3. "Token renewal and re-authentication flow"

Each query retrieves different chunks. Union → deduplicate → re-rank.
Result: significantly higher recall than single query.
```

```python
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)  # slight temperature for diversity

# MultiQueryRetriever wraps an existing retriever
multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,  # your existing vector retriever
    llm=llm,
    include_original=True  # also run the original query
)

# Usage — same interface as regular retriever
docs = multi_query_retriever.invoke("auth token expiry handling")

# What happens internally:
# 1. LLM generates 3 alternative queries (prompt is built in)
# 2. Each query is run through base_retriever
# 3. Results are deduplicated (by page_content hash)
# 4. Union of all results returned
```

**Cost:** 1 extra LLM call + k × num_queries retrieval calls.

With 3 generated queries + original = 4 retrieval calls. If base retrieval is Qdrant (~20ms each), that's 4× the retrieval cost — but often much higher recall.

**Engineering tradeoff:**
```
Multi-query:  Higher recall, higher latency, higher cost
              Good for: complex queries, low-frequency high-stakes questions
              Bad for: high-throughput, cost-sensitive, real-time chat

Single query: Faster, cheaper, good enough for simple factual questions
```

### Technique 3: Step-Back Prompting

**The idea:** Sometimes the query is too specific. Ask a more general question first, retrieve context for that, then answer the specific question.

```
Too specific (retrieves nothing):
  "What is the rate limit for /v2/completions endpoint for Tier 2 accounts?"

Step back (abstracts to principle):
  "What are the rate limiting policies for API endpoints?"

Retrieve docs for the general question → answer the specific question with that context.
```

```python
step_back_prompt = ChatPromptTemplate.from_template(
    """You are an expert at taking a specific question and abstracting it to a
more general question that would help retrieve relevant background information.

Question: {question}
General version of the question:"""
)

step_back_chain = step_back_prompt | llm | StrOutputParser()

def step_back_retriever(query: str):
    # Generate general version of query
    general_query = step_back_chain.invoke({"question": query})

    # Retrieve docs for both specific and general query
    specific_docs = base_retriever.invoke(query)
    general_docs = base_retriever.invoke(general_query)

    # Deduplicate and combine
    seen = set()
    combined = []
    for doc in specific_docs + general_docs:
        h = hash(doc.page_content)
        if h not in seen:
            seen.add(h)
            combined.append(doc)

    return combined
```

---

## 4. Self-RAG: The Feedback Loop

### The Problem with Blind Retrieval

In basic RAG, retrieval is unconditional. The pipeline always:
1. Retrieves k chunks
2. Stuffs them in the prompt
3. Generates an answer

But what if:
- Retrieval returned irrelevant chunks? → LLM answers from noise
- The question doesn't need retrieval at all? → Unnecessary API call cost
- The answer is not grounded in the retrieved context? → Hallucination passed through

Self-RAG introduces **conditional retrieval** and **self-critique** — the model decides when to retrieve, assesses what it retrieved, and evaluates its own output.

### Self-RAG Mechanism

Original paper (Asai et al., 2023) trains a special model. In practice, you implement the same logic as a workflow — which is what you'll do in production:

```
                    ┌─────────────────────────────────┐
                    │         Self-RAG Workflow        │
                    └─────────────────────────────────┘

User Query
    │
    ▼
┌─────────────────────────┐
│ RETRIEVE? Decision      │ ← LLM grades: does this query need docs?
│ "What is 2+2?"  → NO   │   (math, chitchat, general knowledge = no)
│ "Our SLA?" → YES        │   (proprietary info = yes)
└────────┬────────────────┘
         │ YES
         ▼
┌─────────────────────────┐
│ Retrieve top-k chunks   │ ← standard vector / hybrid retrieval
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ RELEVANT? Decision      │ ← LLM grades each chunk: relevant or not?
│ (per-chunk relevance)   │   filter out irrelevant chunks
└────────┬────────────────┘
         │ relevant chunks only
         ▼
┌─────────────────────────┐
│ Generate answer         │ ← LLM generates using only relevant chunks
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ GROUNDED? Decision      │ ← Is every claim in the answer supported by a chunk?
│ (faithfulness check)    │   Grade: FULLY_SUPPORTED / PARTIALLY / NOT_SUPPORTED
└────────┬────────────────┘
         │ FULLY_SUPPORTED
         ▼
┌─────────────────────────┐
│ USEFUL? Decision        │ ← Does the answer actually address the question?
└────────┬────────────────┘
         ▼
      Final Answer
```

### Implementation: Self-RAG Graders

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# ── 1. Retrieval decision grader ───────────────────────────────────────────────

class RetrievalDecision(BaseModel):
    should_retrieve: bool = Field(description="Whether retrieval is needed to answer this query")
    reasoning: str = Field(description="Why retrieval is or is not needed")

retrieval_grader_prompt = ChatPromptTemplate.from_template(
    """You are an expert at deciding whether a question requires retrieving information
from a knowledge base or can be answered with general knowledge.

Retrieval IS needed for: company-specific policies, product details, proprietary data,
technical documentation, recent events.

Retrieval is NOT needed for: math, general coding questions, public knowledge,
chitchat, clarifications of the question itself.

Question: {question}

Respond with JSON: {{"should_retrieve": true/false, "reasoning": "..."}}"""
)

retrieval_grader = retrieval_grader_prompt | llm.with_structured_output(RetrievalDecision)

# ── 2. Chunk relevance grader ─────────────────────────────────────────────────

class ChunkRelevance(BaseModel):
    is_relevant: bool = Field(description="Whether this chunk is relevant to the question")

relevance_grader_prompt = ChatPromptTemplate.from_template(
    """Is the following document chunk relevant to answering this question?
Grade strictly — only mark relevant if the chunk contains information useful for answering.

Question: {question}
Chunk: {chunk}

Respond with JSON: {{"is_relevant": true/false}}"""
)

relevance_grader = relevance_grader_prompt | llm.with_structured_output(ChunkRelevance)

# ── 3. Faithfulness grader ────────────────────────────────────────────────────

class FaithfulnessGrade(BaseModel):
    is_faithful: bool = Field(description="Whether answer is fully supported by the context")
    unsupported_claims: list[str] = Field(description="Claims not found in context", default=[])

faithfulness_grader_prompt = ChatPromptTemplate.from_template(
    """Is every factual claim in the answer supported by the provided context?
Mark as NOT faithful if the answer contains information not present in the context.

Context: {context}
Answer: {answer}

Respond with JSON: {{"is_faithful": true/false, "unsupported_claims": [...]}}"""
)

faithfulness_grader = faithfulness_grader_prompt | llm.with_structured_output(FaithfulnessGrade)

# ── Full Self-RAG pipeline ────────────────────────────────────────────────────

from langchain_core.runnables import RunnablePassthrough

def self_rag_pipeline(query: str, retriever, llm) -> dict:
    # Step 1: Should we retrieve?
    decision = retrieval_grader.invoke({"question": query})
    if not decision.should_retrieve:
        # Answer directly from LLM knowledge
        answer = llm.invoke(query).content
        return {"answer": answer, "retrieved": False, "chunks_used": 0}

    # Step 2: Retrieve
    raw_docs = retriever.invoke(query)

    # Step 3: Grade chunk relevance
    relevant_docs = []
    for doc in raw_docs:
        grade = relevance_grader.invoke({"question": query, "chunk": doc.page_content})
        if grade.is_relevant:
            relevant_docs.append(doc)

    if not relevant_docs:
        return {"answer": "I don't have relevant information to answer this question.", "retrieved": True, "chunks_used": 0}

    # Step 4: Generate answer
    context = "\n\n---\n\n".join(doc.page_content for doc in relevant_docs)
    answer_prompt = f"Answer the question using ONLY the context below.\n\nContext:\n{context}\n\nQuestion: {query}\nAnswer:"
    answer = llm.invoke(answer_prompt).content

    # Step 5: Check faithfulness
    faith = faithfulness_grader.invoke({"context": context, "answer": answer})
    if not faith.is_faithful:
        # Re-generate with stricter instruction
        strict_prompt = f"""Answer ONLY using facts explicitly stated in the context.
If information is not in the context, say so. Do NOT add any external knowledge.

Context:
{context}

Question: {query}
Answer:"""
        answer = llm.invoke(strict_prompt).content

    return {
        "answer": answer,
        "retrieved": True,
        "chunks_used": len(relevant_docs),
        "faithfulness_warnings": faith.unsupported_claims
    }
```

### What the Graders Actually Cost

```
Each grader call = 1 LLM call (gpt-4o-mini)

For a query with 5 retrieved chunks:
  Retrieval decision:   1 call
  Chunk relevance:      5 calls (one per chunk, can parallelize)
  Answer generation:    1 call
  Faithfulness check:   1 call
  ─────────────────────────────
  Total:                8 LLM calls vs. 1 for naive RAG

Cost multiplier: ~8x
Latency (parallel): ~600-900ms extra (with async chunk grading)
Latency (serial):   ~2-4s extra

When it's worth it:
  - High-stakes answers (legal, medical, financial compliance)
  - When hallucination has real consequences
  - Lower-volume, quality-first use cases

When to skip:
  - High-throughput chatbots (> 100 req/s)
  - Low-stakes FAQ answers
  - When you have strong eval metrics and basic RAG already performs well
```

---

## 5. Multi-Hop Retrieval: Answering Complex Questions

### The Problem

Some questions cannot be answered with a single retrieval step:

```
Q: "What are the pricing differences between Pro and Enterprise for EU customers,
    and how do the GDPR compliance features affect those tiers?"

Facts needed:
  Fact A: Pro plan pricing (from pricing.md, chunk 3)
  Fact B: Enterprise plan pricing (from pricing.md, chunk 7)
  Fact C: EU regional pricing (from regional-pricing.md, chunk 2)
  Fact D: GDPR features per tier (from compliance.md, chunk 5)

No single embedding of the full query will consistently retrieve all 4 chunks.
```

Multi-hop retrieval breaks the question into sub-questions, retrieves for each, then synthesizes.

### Technique 1: Query Decomposition

```python
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel

class DecomposedQueries(BaseModel):
    sub_questions: list[str]

decompose_prompt = ChatPromptTemplate.from_template(
    """Break down this complex question into 2-4 simpler sub-questions that can each
be answered independently by searching a knowledge base.

Each sub-question should be self-contained (not reference "the above" or "the previous").
Return ONLY the sub-questions that are necessary — don't over-decompose simple questions.

Question: {question}

Return JSON: {{"sub_questions": ["...", "...", ...]}}"""
)

decomposer = decompose_prompt | llm.with_structured_output(DecomposedQueries)

def multi_hop_retrieve(query: str, retriever) -> list:
    """Decompose query → retrieve for each sub-question → deduplicate."""
    decomposed = decomposer.invoke({"question": query})
    sub_questions = decomposed.sub_questions

    all_docs = []
    seen_content = set()

    for sub_q in sub_questions:
        docs = retriever.invoke(sub_q)
        for doc in docs:
            content_hash = hash(doc.page_content[:100])  # hash first 100 chars as proxy
            if content_hash not in seen_content:
                seen_content.add(content_hash)
                all_docs.append(doc)

    return all_docs
```

### Technique 2: Iterative Retrieval (Retrieve → Read → Retrieve Again)

More powerful than decomposition: retrieve, partially read, decide what's still missing, retrieve again.

```
Iteration 1:
  Query: "What's the refund policy for Enterprise?"
  Retrieves: "Enterprise plan features and pricing..."
  LLM reads it and notes: "I have pricing info but need to find the refund terms"

Iteration 2:
  New query: "refund and cancellation terms for enterprise agreements"
  Retrieves: "Enterprise contracts include a 30-day money-back guarantee..."
  LLM now has enough to answer
```

```python
def iterative_retrieval(query: str, retriever, llm, max_iterations: int = 3) -> dict:
    """
    Iterative retrieval: retrieve, assess gaps, re-retrieve.
    Stops when LLM has enough to answer or max iterations reached.
    """
    all_docs = []
    current_query = query
    seen_hashes = set()

    assess_prompt = ChatPromptTemplate.from_template(
        """Given the question and the retrieved context so far, determine:
1. Can you answer the question fully with the current context? (yes/no)
2. If no, what specific information is still missing? (write a search query for it)

Question: {question}
Current context: {context}

Respond with JSON:
{{"can_answer": true/false, "missing_query": "..." or null}}"""
    )

    class AssessmentResult(BaseModel):
        can_answer: bool
        missing_query: str | None = None

    assessor = assess_prompt | llm.with_structured_output(AssessmentResult)

    for iteration in range(max_iterations):
        # Retrieve for current query
        new_docs = retriever.invoke(current_query)

        # Add new unique docs
        for doc in new_docs:
            h = hash(doc.page_content[:100])
            if h not in seen_hashes:
                seen_hashes.add(h)
                all_docs.append(doc)

        # Assess if we have enough
        context = "\n\n---\n\n".join(d.page_content for d in all_docs)
        assessment = assessor.invoke({"question": query, "context": context})

        if assessment.can_answer or not assessment.missing_query:
            break  # We have enough, or model can't identify what's missing

        # Update query for next iteration
        current_query = assessment.missing_query

    # Final answer generation
    context = "\n\n---\n\n".join(d.page_content for d in all_docs)
    answer = llm.invoke(
        f"Answer using ONLY this context:\n{context}\n\nQuestion: {query}\nAnswer:"
    ).content

    return {"answer": answer, "iterations": iteration + 1, "docs_used": len(all_docs)}
```

### When Multi-Hop Adds Value (and When It Doesn't)

```
USE multi-hop when:
  ✓ Analytical questions requiring synthesis ("compare X and Y across dimensions A, B, C")
  ✓ Questions with known sub-structures ("what is the process for X when condition Y applies?")
  ✓ Questions spanning multiple document types (pricing + compliance + SLA docs)

SKIP multi-hop when:
  ✗ Simple factual lookups ("what is the refund window?")
  ✗ Real-time, latency-sensitive applications (adds 2-5s per iteration)
  ✗ When your single-hop RAG already has high context recall (> 0.90)

Cost reality check:
  Iterative retrieval with 3 iterations:
    - 3x retrieval calls
    - 3x LLM assessment calls
    - 1x final generation
    ≈ 7x the cost of basic RAG per query
```

---

## 6. Combining Techniques: The Advanced RAG Decision Tree

Not every query needs every technique. The art is knowing which to apply when:

```
Incoming Query
      │
      ▼
Is it complex / multi-part?
      ├── YES → Query Decomposition + Multi-Hop
      └── NO
           │
           ▼
      Does vocabulary mismatch matter in your domain?
      (exact codes, product names, jargon)
           ├── YES → Hybrid Search (always use this in production)
           └── NO (pure semantic domain) → vector-only is fine
                │
                ▼
           Is retrieval quality the bottleneck?
           (low context recall scores)
                ├── YES → Add HyDE or Multi-Query
                └── NO
                     │
                     ▼
                Is hallucination the bottleneck?
                (low faithfulness scores)
                     ├── YES → Add Self-RAG graders
                     └── NO → your basic RAG is sufficient for this query type
```

---

## 7. The Full Advanced RAG System: Architecture

```
                    ┌───────────────────────────────────────────────────────┐
                    │                 ADVANCED RAG SYSTEM                   │
                    └───────────────────────────────────────────────────────┘

User Query
    │
    ▼
┌──────────────────────────────────────────────┐
│                QUERY LAYER                    │
│                                              │
│  ┌─────────────────┐  ┌────────────────────┐ │
│  │ Complexity Check │  │ Retrieval Decision  │ │  ← Self-RAG gate
│  │ (simple/complex) │  │ (needs docs or not) │ │
│  └────────┬─────────┘  └─────────┬──────────┘ │
│           │                      │            │
│    ┌──────┴──────┐               │ YES        │
│    │  Complex?   │               │            │
│    └──────┬──────┘               │            │
│      YES  │  NO                  │            │
│           │   └──────────────────┘            │
│    ┌──────▼──────────┐                        │
│    │Query Decomposer │ ← LLM splits to sub-Qs │
│    └──────┬──────────┘                        │
│           │ + original query                  │
└───────────┼───────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────┐
│              RETRIEVAL LAYER                  │
│                                              │
│  For each query:                             │
│  ┌────────────────────────────────────────┐  │
│  │           Hybrid Retriever             │  │
│  │  ┌───────────────┐ ┌────────────────┐  │  │
│  │  │ Dense (vector)│ │ Sparse (BM25)  │  │  │
│  │  │  top-15       │ │  top-15        │  │  │
│  │  └───────────────┘ └────────────────┘  │  │
│  │           ↓ RRF fusion ↓               │  │
│  │         top-20 candidates              │  │
│  └────────────────────────────────────────┘  │
│                     │                        │
│  ┌──────────────────▼──────────────────────┐ │
│  │           Chunk Relevance Grader        │ │  ← Self-RAG grader
│  │  (filter out irrelevant chunks)         │ │
│  └──────────────────┬──────────────────────┘ │
│                     │ relevant chunks only    │
│  ┌──────────────────▼──────────────────────┐ │
│  │           Cross-Encoder Re-Ranker       │ │
│  │  (Cohere rerank-v3, top-20 → top-5)    │ │
│  └──────────────────┬──────────────────────┘ │
└─────────────────────┼────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│            GENERATION LAYER                   │
│                                              │
│  Context Assembly                            │
│  (numbered sources, relevant-last ordering)  │
│           │                                  │
│           ▼                                  │
│        LLM Answer                            │
│           │                                  │
│  Faithfulness Grader ← Self-RAG post-check  │
│           │                                  │
│  Final Answer + Citations                    │
└──────────────────────────────────────────────┘
```

---

## 8. Production Engineering Tradeoffs

### Cost Matrix

| Technique | Extra LLM calls | Extra latency (p50) | Recall gain | When to use |
|-----------|-----------------|---------------------|-------------|-------------|
| Hybrid search | 0 | +0ms (parallel) | +15-30% | Always, especially with jargon |
| Multi-query | 1 (generation) + 3x retrieval | +200-400ms | +20-40% | Complex queries, high recall needed |
| HyDE | 1 (generation) | +150-300ms | +10-25% | Vocab mismatch, q→answer space gap |
| Query decomposition | 1 | +200ms + k×retrieval | +30-50% | Multi-part questions |
| Self-RAG graders | 1+k+1+1 | +500-1500ms | 0 recall, +faithfulness | High-stakes, low-volume |
| Iterative retrieval | 1 per iter | +500ms × iters | +25-50% | Deep analytical questions |

### The "Good Enough" Test

Before adding advanced techniques, measure whether you actually need them:

```python
# Using RAGAS (from Chapter 7) — run these checks BEFORE adding complexity:
# If context_recall > 0.85 and faithfulness > 0.90:
#   → Your basic RAG is working. Don't add complexity without evidence it helps.

# Target failure mode → add specific technique:
#   Low context_recall + keyword-heavy domain  → Add hybrid search
#   Low context_recall + vague queries         → Add multi-query or HyDE
#   Low context_recall + multi-part questions  → Add decomposition
#   Low faithfulness                           → Add Self-RAG faithfulness grader
#   Low answer_relevancy                       → Better prompt / context assembly
```

---

## 9. Common Engineering Mistakes in Advanced RAG

### Mistake 1: Applying every technique to every query
Advanced techniques have real costs. Multi-query for a simple "what is your phone number?" query wastes 4 LLM calls. Route queries: detect complexity first, apply techniques only when justified.

### Mistake 2: Decomposing too aggressively
"What is the refund policy?" does not need decomposition. Over-decomposed queries result in too many chunks, diluted context, higher cost, and often worse answers because the LLM gets confused by too much unrelated context.

### Mistake 3: HyDE hallucinating toward wrong documents
If HyDE generates a confident but factually wrong hypothetical answer, its embedding will retrieve wrong documents. This is worse than naive RAG because you've confidently pointed retrieval in the wrong direction. Mitigation: use HyDE on queries where the general topic is clear but vocabulary differs — not on highly specific factual queries.

### Mistake 4: Not running sub-questions in parallel
Query decomposition creates 3-5 sub-questions. Running retrievals sequentially adds 3-5× latency. Always parallelize:

```python
import asyncio

async def parallel_retrieval(sub_questions: list[str], retriever) -> list:
    """Run all sub-question retrievals concurrently."""
    tasks = [retriever.ainvoke(q) for q in sub_questions]
    results = await asyncio.gather(*tasks)
    # Flatten and deduplicate
    seen = set()
    docs = []
    for result_list in results:
        for doc in result_list:
            h = hash(doc.page_content[:100])
            if h not in seen:
                seen.add(h)
                docs.append(doc)
    return docs
```

### Mistake 5: Treating Self-RAG graders as blocking checkpoints
Serial grading is slow. Grade chunks in parallel, then filter. Faithfulness grading should happen post-generation but can be async (log the result and flag for review rather than blocking the user response).

---

## 10. Interview Traps & Gotchas

### "What's the difference between BM25 and vector search?"
**Wrong answer:** "BM25 is old and vector search is better."
**Correct answer:** They complement each other. BM25 excels at exact term matching (product names, error codes, rare terminology). Vector search excels at semantic similarity. The best production systems use both. The question is always "which does my specific domain lean toward?"

### "Why would HyDE ever perform worse than standard RAG?"
**Answer:** When the generated hypothetical document is factually wrong in ways that shift the embedding toward incorrect document clusters. Example: query about your custom product "Zephyr API v2" — LLM might hallucinate generic API details, and the resulting embedding retrieves documentation about REST APIs in general, not Zephyr-specific docs. HyDE trades the query-document space gap for the risk of hallucinated hypothetical misdirection.

### "How would you design multi-hop RAG for 10,000 req/day?"
**Answer:**
1. Route queries: classify simple vs. complex at ingress. Only complex queries get multi-hop. Simple queries get standard single-hop RAG (saves 80%+ of extra LLM calls if most queries are simple).
2. Parallelize sub-question retrievals with `asyncio.gather()`.
3. Cache sub-question retrieval results in Redis (TTL = document update frequency). Identical sub-questions across different complex queries share cache.
4. Use `gpt-4o-mini` for graders and decomposers, not `gpt-4o`. Graders don't need frontier model capability.
5. At 10k req/day (~7 req/min), you have budget for the extra LLM calls. At 100k req/day, you need to be more selective about which queries get multi-hop.

### "Is Self-RAG production-ready?"
**Answer:** The original paper's trained model is academic. But the *pattern* (conditional retrieval + self-critique) is production-ready if implemented as a workflow. The key engineering decision is: make the graders async and non-blocking for user experience, log faithfulness warnings for monitoring rather than re-generating (adds too much latency for most use cases). Use it selectively, not universally.

---

## 11. ASCII: Advanced RAG Failure Modes vs Fixes

```
FAILURE MODE                    SYMPTOM                         FIX
──────────────────────────────────────────────────────────────────────────────
Vocabulary mismatch           "I don't have info" (but it's    Hybrid search (BM25 + vector)
                              in docs under different terms)

Query too vague               Generic chunks retrieved,         Multi-query retrieval
                              answer doesn't address specifics  or HyDE

Multi-part question           Only partially answered,          Query decomposition
                              misses one of several facts       + multi-hop retrieval

Irrelevant chunks in context  LLM confused, answer drifts       Self-RAG relevance grader
                              off topic                         + score threshold filter

Hallucination despite RAG     Answer contains facts not         Self-RAG faithfulness grader
                              in retrieved docs                 + stricter system prompt

Decomposed → too many chunks  Context too long, LLM loses       Cap total chunks after
after multi-hop               focus, high cost                  dedup; rerank top-10

HyDE retrieves wrong docs     Answer confidently wrong          Fallback to direct query
                              about factual specifics           if HyDE score < threshold
```
