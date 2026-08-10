"""
query_rewriting.py — HyDE and Multi-Query Retrieval

Demonstrates:
  - HyDE: embed hypothetical answer instead of query
  - MultiQueryRetriever: generate query variants, union results
  - Why query embedding ≠ document embedding space

Run:
  pip install langchain langchain-openai langchain-community faiss-cpu rank_bm25
  OPENAI_API_KEY=... python query_rewriting.py
"""

import os
import logging
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Show the queries MultiQueryRetriever generates
logging.getLogger("langchain.retrievers.multi_query").setLevel(logging.INFO)

docs = [
    Document(page_content="Customers can cancel their subscription at any time from the Account Settings page.", metadata={"source": "billing.md"}),
    Document(page_content="Monthly plans are billed on the same date each month. No long-term commitment required.", metadata={"source": "billing.md"}),
    Document(page_content="To terminate your account, navigate to Settings > Account > Cancel Subscription.", metadata={"source": "billing.md"}),
    Document(page_content="Refunds are available within 30 days of purchase for monthly subscribers.", metadata={"source": "refunds.md"}),
    Document(page_content="Annual subscribers may request a prorated refund within 14 days of the billing date.", metadata={"source": "refunds.md"}),
    Document(page_content="Enterprise contracts include custom SLA terms negotiated individually.", metadata={"source": "enterprise.md"}),
]

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

# Base vector store
vectorstore = FAISS.from_documents(docs, embeddings)
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# ── Technique 1: HyDE ─────────────────────────────────────────────────────────
hyde_prompt = ChatPromptTemplate.from_template(
    """Write a concise, factual paragraph that directly answers the following question.
Write confidently as if you have access to accurate documentation.

Question: {question}
Answer:"""
)

hypothetical_doc_chain = hyde_prompt | llm | StrOutputParser()

def hyde_retrieve(query: str, k: int = 3) -> list[Document]:
    """Retrieve using hypothetical document embedding."""
    hypothetical = hypothetical_doc_chain.invoke({"question": query})
    print(f"\n[HyDE] Hypothetical doc: {hypothetical[:150]}...")

    hyp_embedding = embeddings.embed_query(hypothetical)
    return vectorstore.similarity_search_by_vector(hyp_embedding, k=k)

# ── Technique 2: Multi-Query ──────────────────────────────────────────────────
multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=llm,
    include_original=True,  # also run original query
)

def multi_query_retrieve_deduped(query: str) -> list[Document]:
    """Multi-query retrieval with deduplication."""
    docs = multi_query_retriever.invoke(query)
    seen = set()
    unique = []
    for doc in docs:
        key = doc.page_content[:100]
        if key not in seen:
            seen.add(key)
            unique.append(doc)
    return unique

# ── Compare all three approaches ──────────────────────────────────────────────
query = "How do I stop my subscription?"

print("=" * 70)
print(f"Query: '{query}'")
print("Note: docs use 'cancel', 'terminate', 'Account Settings' — not 'stop'")
print("=" * 70)

print("\n--- Direct vector retrieval ---")
direct_docs = base_retriever.invoke(query)
for d in direct_docs:
    print(f"  [{d.metadata['source']}] {d.page_content[:80]}...")

print("\n--- HyDE retrieval ---")
hyde_docs = hyde_retrieve(query)
for d in hyde_docs:
    print(f"  [{d.metadata['source']}] {d.page_content[:80]}...")

print("\n--- Multi-query retrieval (check logs above for generated queries) ---")
mq_docs = multi_query_retrieve_deduped(query)
for d in mq_docs:
    print(f"  [{d.metadata['source']}] {d.page_content[:80]}...")
print(f"  Total unique docs: {len(mq_docs)}")

print("""
What to observe:
  - Direct retrieval may miss "terminate" and "cancel" docs because "stop" isn't close
  - HyDE generates an answer with "cancel" / "Account Settings" → embeds near actual docs
  - Multi-query generates variants like "cancel subscription", "how to unsubscribe", etc.
    Each variant retrieves different chunks → union has higher recall

Trade-off:
  - HyDE: 1 extra LLM call, but single retrieval
  - Multi-query: 1 LLM call + 3-4x retrieval calls, higher recall
  - Neither is always better — measure on your specific corpus
""")
