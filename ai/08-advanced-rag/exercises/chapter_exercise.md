# Chapter Exercise — Advanced RAG
## Build a Hybrid Retriever with Query Rewriting

**Estimated time:** 45-60 minutes

---

## Problem Statement

You have a knowledge base of software documentation. Your existing vector-only RAG pipeline has these RAGAS scores:

```
context_recall:    0.74   ← too low, good docs are being missed
faithfulness:      0.91   ← good, LLM is grounded
answer_relevancy:  0.83   ← acceptable
```

The low recall is your bottleneck. You suspect two causes:
1. Users search for "API rate limits" but docs say "request throttling" — vocabulary mismatch
2. Complex queries like "How do I handle errors and implement retry logic?" need better query expansion

Your task: implement a hybrid retriever with multi-query expansion and compare RAGAS scores.

---

## Acceptance Criteria

- [ ] BM25 retriever and vector retriever are combined using `EnsembleRetriever`
- [ ] Multi-query retrieval is added on top of the ensemble retriever
- [ ] Results are deduplicated before returning
- [ ] The pipeline runs end-to-end on the test queries below
- [ ] You can explain what RRF is doing and why weights=[0.6, 0.4] makes sense

---

## Starter Code

```python
# chapter_exercise_solution.py
# TODO: Fill in all sections marked with # TODO

import os
from typing import Optional
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# ── Sample documents (substitute your real docs here) ─────────────────────────
sample_docs = [
    Document(page_content="The API enforces request throttling at 100 requests per minute for free tier accounts.", metadata={"source": "api-limits.md"}),
    Document(page_content="Rate limits are applied per API key, not per user account.", metadata={"source": "api-limits.md"}),
    Document(page_content="When a 429 Too Many Requests error occurs, wait for the Retry-After header value before retrying.", metadata={"source": "error-handling.md"}),
    Document(page_content="Implement exponential backoff when handling transient errors: start at 1s, double each retry, cap at 32s.", metadata={"source": "error-handling.md"}),
    Document(page_content="Authentication uses Bearer tokens passed in the Authorization header.", metadata={"source": "auth.md"}),
    Document(page_content="Tokens expire after 24 hours. Use the refresh endpoint to obtain a new token.", metadata={"source": "auth.md"}),
    Document(page_content="The /v2/completions endpoint accepts POST requests with a JSON body.", metadata={"source": "api-reference.md"}),
    Document(page_content="Webhooks can be configured in account settings. They fire on events: message.created, session.ended.", metadata={"source": "webhooks.md"}),
]

# ── Setup ─────────────────────────────────────────────────────────────────────
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# TODO 1: Create an in-memory vector store from sample_docs
# Hint: Use FAISS (pip install faiss-cpu) or Chroma — pick whichever you prefer
# vectorstore = ???
vectorstore = None  # replace this

# TODO 2: Create a vector retriever from the vectorstore
# Return top-5 results
# vector_retriever = ???
vector_retriever = None  # replace this

# TODO 3: Create a BM25 retriever from sample_docs
# Return top-5 results
# bm25_retriever = ???
bm25_retriever = None  # replace this

# TODO 4: Combine them into an EnsembleRetriever with appropriate weights
# Think about: should vector or BM25 be weighted higher for a technical docs domain?
# ensemble_retriever = ???
ensemble_retriever = None  # replace this

# TODO 5: Wrap the ensemble retriever with MultiQueryRetriever
# Use llm to generate 3 alternative queries
# multi_query_retriever = ???
multi_query_retriever = None  # replace this

# ── Test queries ──────────────────────────────────────────────────────────────
test_queries = [
    "How do I handle API rate limits?",          # vocab mismatch: "throttling" vs "rate limits"
    "What should I do when requests fail?",       # vague — needs multi-query expansion
    "How long are auth tokens valid?",            # direct factual lookup
]

# ── Main retrieval function ───────────────────────────────────────────────────
def retrieve_with_dedup(query: str, retriever) -> list[Document]:
    """
    TODO 6: Implement retrieval with deduplication.

    Steps:
    1. Invoke the retriever with the query
    2. Deduplicate results (use first 100 chars of page_content as hash key)
    3. Return deduplicated list

    Why deduplicate? Multi-query retrieval may return the same chunk from
    multiple query variants. Without dedup, the LLM sees the same chunk 3x.
    """
    # TODO: implement this
    pass

# ── RAG chain ─────────────────────────────────────────────────────────────────
def build_rag_chain(retriever):
    """TODO 7: Build a simple RAG chain using the retriever and llm."""
    # Hint: Review Chapter 7 LCEL chain pattern
    # Don't forget: format_docs function to join chunks with separators
    # TODO: implement this
    pass

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if multi_query_retriever is None:
        print("Complete the TODOs before running.")
    else:
        rag_chain = build_rag_chain(multi_query_retriever)

        for query in test_queries:
            print(f"\nQuery: {query}")
            print("-" * 60)

            # Show retrieved docs
            docs = retrieve_with_dedup(query, multi_query_retriever)
            print(f"Retrieved {len(docs)} unique chunks:")
            for doc in docs:
                print(f"  [{doc.metadata.get('source')}] {doc.page_content[:80]}...")

            # Show answer
            answer = rag_chain.invoke(query)
            print(f"\nAnswer: {answer}")
```

---

## What to Verify

After implementing:

- [ ] For "API rate limits" query: does the response include the throttling chunk (vocabulary mismatch resolved)?
- [ ] For "when requests fail" query: does multi-query generate useful variants? (enable verbose logging to see)
- [ ] Is deduplication working? Try printing `len(docs)` with and without dedup — multi-query should produce duplicates before dedup
- [ ] Does the EnsembleRetriever return results from both BM25 and vector sources? (add metadata to track which retriever found which doc to verify)
- [ ] Try changing weights to [0.4, 0.6] (BM25-heavy) — does retrieval quality change for exact term queries?

---

## Hints (read only if stuck)

<details>
<summary>Hint 1: Creating a FAISS vector store</summary>

```python
from langchain_community.vectorstores import FAISS
vectorstore = FAISS.from_documents(sample_docs, embeddings)
```

</details>

<details>
<summary>Hint 2: BM25 retriever setup</summary>

```python
bm25_retriever = BM25Retriever.from_documents(sample_docs)
bm25_retriever.k = 5
```

</details>

<details>
<summary>Hint 3: Deduplication logic</summary>

```python
def retrieve_with_dedup(query: str, retriever) -> list[Document]:
    docs = retriever.invoke(query)
    seen = set()
    unique = []
    for doc in docs:
        key = doc.page_content[:100]
        if key not in seen:
            seen.add(key)
            unique.append(doc)
    return unique
```

</details>

<details>
<summary>Hint 4: Enable MultiQueryRetriever logging to see generated queries</summary>

```python
import logging
logging.getLogger("langchain.retrievers.multi_query").setLevel(logging.INFO)
```

</details>

---

## Reflection Questions (answer mentally after completing)

1. For the "rate limits" query, which retriever found the relevant chunk — BM25 or vector? How can you tell?
2. What alternative queries did MultiQueryRetriever generate for "when requests fail"? Were they better than the original?
3. What would break if you used this setup with 1 million documents? What would you change?
