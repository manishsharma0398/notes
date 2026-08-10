"""
Example 2: Chunking strategies + Qdrant local vector store
Shows document chunking, batched embedding, upsert, and similarity search.
Dependencies: qdrant-client, langchain-text-splitters, openai, numpy
Run: python 02_vector_store_qdrant.py
Note: Uses Qdrant in-memory mode — no server needed for this example.
"""

import os
import uuid
import numpy as np
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams,
    PointStruct, Filter, FieldCondition, MatchValue
)
from langchain_text_splitters import RecursiveCharacterTextSplitter

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
COLLECTION_NAME = "docs"

# Sample documents to index
DOCUMENTS = [
    {
        "source": "password_policy.md",
        "text": """
        # Password Policy

        ## Resetting Your Password
        To reset your password, go to the login page and click "Forgot password".
        Enter your registered email address. You will receive a reset link within 5 minutes.
        The reset link expires after 24 hours. If you don't receive the email, check your
        spam folder or contact support@company.com.

        ## Password Requirements
        Passwords must be at least 12 characters long. They must include at least one
        uppercase letter, one lowercase letter, one number, and one special character.
        You cannot reuse your last 5 passwords.

        ## Account Lockout
        After 5 failed login attempts, your account will be locked for 30 minutes.
        Contact support to unlock early.
        """,
        "doc_type": "policy",
        "tenant_id": "acme",
    },
    {
        "source": "refund_policy.md",
        "text": """
        # Refund Policy

        ## Standard Refunds
        Products can be returned within 30 days of purchase for a full refund.
        To initiate a return, go to Orders > Return Item in your account dashboard.

        ## Digital Products
        Digital downloads are non-refundable once accessed. Exceptions are made for
        defective products that cannot be replaced.

        ## Processing Time
        Refunds are processed within 5-7 business days. The credit appears on your
        original payment method. For questions, contact billing@company.com.
        """,
        "doc_type": "policy",
        "tenant_id": "acme",
    },
    {
        "source": "shipping_info.md",
        "text": """
        # Shipping Information

        ## Standard Shipping
        Standard shipping takes 5-7 business days. Orders placed before 2 PM EST
        ship the same day. Free shipping on orders over $50.

        ## Express Shipping
        Express shipping is available for $15.99. Orders arrive in 1-2 business days.

        ## International Shipping
        We ship to 45 countries. International shipping takes 7-14 business days.
        Customs fees are the responsibility of the recipient.
        """,
        "doc_type": "info",
        "tenant_id": "acme",
    },
]


def embed_batch(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def chunk_documents(documents: list[dict]) -> list[dict]:
    """
    Split each document into chunks using RecursiveCharacterTextSplitter.
    Returns a flat list of chunk dicts with metadata preserved.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=300,           # tokens approximated by character count here
        chunk_overlap=30,
        separators=["\n\n", "\n", " ", ""],
    )

    chunks = []
    for doc in documents:
        split_texts = splitter.split_text(doc["text"])
        for idx, chunk_text in enumerate(split_texts):
            chunks.append({
                "id": str(uuid.uuid4()),
                "text": chunk_text.strip(),
                "source": doc["source"],
                "doc_type": doc["doc_type"],
                "tenant_id": doc["tenant_id"],
                "chunk_index": idx,
            })
    return chunks


def ingest(qdrant: QdrantClient, documents: list[dict]):
    """Full ingestion pipeline: chunk → embed (batched) → upsert."""

    # Step 1: Chunk
    print("Chunking documents...")
    chunks = chunk_documents(documents)
    print(f"  {len(documents)} docs → {len(chunks)} chunks")

    # Step 2: Embed in batch (one API call for all chunks)
    print("Embedding chunks...")
    texts = [c["text"] for c in chunks]
    embeddings = embed_batch(texts)
    print(f"  Embedded {len(embeddings)} chunks, dim={len(embeddings[0])}")

    # Step 3: Upsert into Qdrant
    print("Upserting to Qdrant...")
    points = [
        PointStruct(
            id=chunk["id"],
            vector=embedding,
            payload={
                "text": chunk["text"],          # must store: needed for retrieval
                "source": chunk["source"],
                "doc_type": chunk["doc_type"],
                "tenant_id": chunk["tenant_id"],
                "chunk_index": chunk["chunk_index"],
            }
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]
    qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
    print(f"  Upserted {len(points)} points")


def search(qdrant: QdrantClient, query: str, top_k: int = 3, tenant_id: str | None = None):
    """
    Embed query → ANN search → return top_k results.
    Optionally filter by tenant_id (metadata filter).
    """
    # Embed the query (separate API call from document embedding)
    query_vec = embed_batch([query])[0]

    # Build optional metadata filter
    filters = None
    if tenant_id:
        filters = Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        )

    results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vec,
        query_filter=filters,
        limit=top_k,
        with_payload=True,      # include the metadata + text in response
    )

    return results


def main():
    # Use in-memory Qdrant (no server needed)
    qdrant = QdrantClient(":memory:")

    # Create collection with cosine distance
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
    )

    # Ingest all documents
    ingest(qdrant, DOCUMENTS)

    # --- Semantic queries ---
    queries = [
        ("How do I reset my password?", "acme"),
        ("I want a refund for my order", "acme"),
        ("How long does shipping take?", "acme"),
    ]

    print("\n" + "="*60)
    print("SEARCH RESULTS")
    print("="*60)

    for query, tenant in queries:
        print(f"\nQuery: '{query}'")
        results = search(qdrant, query, top_k=2, tenant_id=tenant)
        for i, r in enumerate(results, 1):
            print(f"  Result {i} (score={r.score:.4f}, source={r.payload['source']}):")
            print(f"    '{r.payload['text'][:120]}...'")

    # --- Demonstrate: wrong tenant filter returns nothing ---
    print("\n--- Filtering by non-existent tenant ---")
    results = search(qdrant, "reset password", top_k=3, tenant_id="other-company")
    print(f"Results for tenant='other-company': {len(results)} (expected 0)")

    # --- Show what's stored ---
    print("\n--- Collection stats ---")
    info = qdrant.get_collection(COLLECTION_NAME)
    print(f"Total vectors indexed: {info.points_count}")


if __name__ == "__main__":
    main()
