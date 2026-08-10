"""
Example 2: Production-grade RAG chain with LangChain LCEL
==========================================================
Shows:
  - LCEL chain composition (retriever | format_docs | prompt | llm | parser)
  - Streaming LLM output
  - Score-based chunk filtering
  - Context assembly with "lost in the middle" ordering
  - Latency measurement at each stage

Requirements:
  pip install langchain langchain-openai langchain-qdrant qdrant-client

Setup:
  export OPENAI_API_KEY="..."
  # Uses Qdrant in-memory mode
"""

import os
import time
from typing import Iterator
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

# ─── Setup ───────────────────────────────────────────────────────────────────

qdrant_client = QdrantClient(":memory:")
qdrant_client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = QdrantVectorStore(
    client=qdrant_client,
    collection_name="docs",
    embedding=embeddings,
)

# ─── Ingest sample documents ─────────────────────────────────────────────────

SAMPLE_DOCS = [
    Document(
        page_content=(
            "Monthly subscribers can cancel at any time from their account settings. "
            "Cancellation takes effect at the end of the current billing period. "
            "No refunds are issued for partial months."
        ),
        metadata={"source": "cancellation_policy.md", "doc_type": "policy"},
    ),
    Document(
        page_content=(
            "Annual subscribers who cancel within 14 days of renewal are eligible "
            "for a full refund. After 14 days, no refund is issued for annual plans."
        ),
        metadata={"source": "cancellation_policy.md", "doc_type": "policy"},
    ),
    Document(
        page_content=(
            "Enterprise customers have access to 24/7 priority support via a dedicated "
            "Slack channel. Response SLA: 4 hours for P1 issues, 24 hours for P2, "
            "72 hours for general inquiries."
        ),
        metadata={"source": "enterprise_sla.md", "doc_type": "sla"},
    ),
    Document(
        page_content=(
            "All data is encrypted at rest using AES-256 and in transit using TLS 1.3. "
            "We are SOC 2 Type II certified. Annual penetration tests are conducted "
            "by third-party security firms."
        ),
        metadata={"source": "security.md", "doc_type": "technical"},
    ),
    Document(
        page_content=(
            "Refunds are processed within 5-7 business days to the original payment method. "
            "Digital products are non-refundable once downloaded. Physical products "
            "can be returned within 30 days for a full refund."
        ),
        metadata={"source": "refund_policy.md", "doc_type": "policy"},
    ),
]

print("[setup] Ingesting documents...")
t0 = time.perf_counter()
vectorstore.add_documents(SAMPLE_DOCS)
print(f"[setup] Ingestion complete ({time.perf_counter()-t0:.2f}s)")


# ─── Retriever ───────────────────────────────────────────────────────────────

# MMR retriever: fetch 10 candidates, select 4 with diversity
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 4, "fetch_k": 10, "lambda_mult": 0.6}
)


# ─── Context Assembly ────────────────────────────────────────────────────────

def format_docs_with_ordering(docs: list[Document]) -> str:
    """
    Apply "lost in the middle" mitigation:
    Reverse the list so most-relevant (rank 1) goes LAST in the context string.
    Label each chunk with its source for citation.
    """
    ordered = list(reversed(docs))  # most relevant = last = attended to best

    parts = []
    for i, doc in enumerate(ordered, 1):
        source = doc.metadata.get("source", "unknown")
        parts.append(f"[Source {i}: {source}]\n{doc.page_content}")

    context = "\n\n---\n\n".join(parts)

    # Debug: show what's going into the prompt
    print(f"\n[context] Assembled {len(docs)} chunks:")
    for i, doc in enumerate(docs, 1):
        print(f"  Rank {i}: {doc.metadata.get('source')} — '{doc.page_content[:60]}...'")

    return context


# ─── Prompt ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a helpful assistant for a SaaS company.
Answer questions using ONLY the provided context.
If the answer is not in the context, respond with: "I don't have information about that."
Do not guess or use outside knowledge. Cite the source when possible.

Context:
{context}"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{question}"),
])

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


# ─── LCEL Chain ──────────────────────────────────────────────────────────────

rag_chain = (
    {
        "context": retriever | format_docs_with_ordering,
        "question": RunnablePassthrough(),
    }
    | prompt
    | llm
    | StrOutputParser()
)


# ─── Non-streaming invoke ─────────────────────────────────────────────────────

def ask(query: str) -> str:
    print(f"\n{'='*60}")
    print(f"[query] {query}")
    t_start = time.perf_counter()
    answer = rag_chain.invoke(query)
    elapsed = time.perf_counter() - t_start
    print(f"[latency] Total: {elapsed:.2f}s")
    print(f"[answer] {answer}")
    return answer


# ─── Streaming invoke ─────────────────────────────────────────────────────────

def ask_streaming(query: str):
    """Demonstrates streaming token-by-token output."""
    print(f"\n{'='*60}")
    print(f"[streaming query] {query}")
    print("[answer] ", end="", flush=True)

    t_start = time.perf_counter()
    first_token_logged = False

    for token in rag_chain.stream(query):
        if not first_token_logged:
            ttft = time.perf_counter() - t_start
            print(f"[TTFT: {ttft:.2f}s] ", end="", flush=True)
            first_token_logged = True
        print(token, end="", flush=True)

    total = time.perf_counter() - t_start
    print(f"\n[latency] Total streaming: {total:.2f}s")


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Non-streaming queries
    ask("What is the cancellation policy for monthly subscribers?")
    ask("What are the enterprise support SLAs?")
    ask("What is the price of the Enterprise plan?")  # not in docs

    # Streaming demo
    ask_streaming("Can annual subscribers get a refund?")
