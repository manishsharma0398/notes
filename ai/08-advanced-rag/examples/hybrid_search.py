"""
hybrid_search.py — Hybrid BM25 + Vector Search with RRF

Demonstrates:
  - BM25Retriever (in-memory keyword search)
  - Vector retriever (semantic search)
  - EnsembleRetriever combining both via RRF
  - Why RRF uses ranks, not raw scores

Run:
  pip install langchain langchain-openai langchain-community faiss-cpu rank_bm25
  OPENAI_API_KEY=... python hybrid_search.py
"""

import os
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

# ── Sample docs with intentional vocabulary mismatch ─────────────────────────
docs = [
    Document(page_content="The API enforces request throttling at 100 requests per minute.", metadata={"source": "api-limits.md", "topic": "throttling"}),
    Document(page_content="Rate limiting applies per API key. Free tier: 60 req/min. Pro: 300 req/min.", metadata={"source": "api-limits.md", "topic": "rate limits"}),
    Document(page_content="When you receive a 429 error, wait for the Retry-After header before retrying.", metadata={"source": "error-handling.md", "topic": "429 error"}),
    Document(page_content="Implement exponential backoff: start at 1s, double each attempt, cap at 32s.", metadata={"source": "error-handling.md", "topic": "retry logic"}),
    Document(page_content="OAuth2 tokens expire after 24 hours. Use /refresh to get a new token.", metadata={"source": "auth.md", "topic": "token expiry"}),
    Document(page_content="Bearer tokens are passed in the Authorization header: 'Bearer <token>'", metadata={"source": "auth.md", "topic": "authentication"}),
]

# ── Setup ─────────────────────────────────────────────────────────────────────
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Vector store
vectorstore = FAISS.from_documents(docs, embeddings)
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# BM25 retriever
bm25_retriever = BM25Retriever.from_documents(docs)
bm25_retriever.k = 3

# Hybrid: 60% vector weight, 40% BM25 weight in RRF
ensemble_retriever = EnsembleRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    weights=[0.6, 0.4]
)

# ── Test with vocabulary mismatch query ───────────────────────────────────────
test_cases = [
    {
        "query": "API rate limits",
        "note": "User says 'rate limits' — docs use both 'throttling' and 'rate limiting'"
    },
    {
        "query": "request throttling",
        "note": "User says 'throttling' — exact term in first doc"
    },
    {
        "query": "what happens when I send too many requests",
        "note": "Semantic paraphrase — no exact term match"
    }
]

for tc in test_cases:
    print(f"\n{'='*60}")
    print(f"Query: {tc['query']}")
    print(f"Note:  {tc['note']}")
    print()

    # Compare retrievers
    vector_docs = vector_retriever.invoke(tc["query"])
    bm25_docs = bm25_retriever.invoke(tc["query"])
    hybrid_docs = ensemble_retriever.invoke(tc["query"])

    print("Vector only:")
    for d in vector_docs:
        print(f"  [{d.metadata['topic']}] {d.page_content[:60]}...")

    print("BM25 only:")
    for d in bm25_docs:
        print(f"  [{d.metadata['topic']}] {d.page_content[:60]}...")

    print("Hybrid (RRF):")
    for d in hybrid_docs:
        print(f"  [{d.metadata['topic']}] {d.page_content[:60]}...")

# ── What you should observe ───────────────────────────────────────────────────
print("""
What to observe:
  - "API rate limits" query: BM25 finds exact "rate limiting" doc; vector finds semantic neighbors
  - "request throttling" query: BM25 scores the "throttling" doc very highly (exact match)
  - "too many requests" query: only vector search finds relevant docs (no keyword overlap)
  - Hybrid results are consistently better across all three query styles

Key insight: No single retriever wins all cases. Hybrid does.
""")
