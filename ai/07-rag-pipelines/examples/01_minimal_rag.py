"""
Example 1: Minimal RAG pipeline with Qdrant + OpenAI
=====================================================
Shows the full retrieve-then-generate pattern with explicit logging
of what happens at each step. No LangChain — raw API calls.

Requirements:
  pip install openai qdrant-client

Setup:
  export OPENAI_API_KEY="..."
  # Uses Qdrant in-memory mode (no server needed)
"""

import os
import json
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
qdrant = QdrantClient(":memory:")  # in-memory for this demo

EMBED_MODEL = "text-embedding-3-small"
LLM_MODEL = "gpt-4o-mini"
COLLECTION = "docs"
DIM = 1536

# ─── Sample documents ────────────────────────────────────────────────────────

DOCUMENTS = [
    {
        "id": 1,
        "source": "policies/cancellation.md",
        "text": (
            "Monthly subscribers can cancel at any time from their account settings. "
            "Cancellation takes effect at the end of the current billing period. "
            "No refunds are issued for partial months. Annual subscribers who cancel "
            "within 14 days of renewal are eligible for a full refund."
        ),
    },
    {
        "id": 2,
        "source": "policies/refunds.md",
        "text": (
            "Refunds are processed within 5-7 business days to the original payment method. "
            "Digital products are non-refundable once downloaded. Physical products can be "
            "returned within 30 days for a full refund. Shipping costs are non-refundable."
        ),
    },
    {
        "id": 3,
        "source": "policies/support.md",
        "text": (
            "Support is available Monday to Friday, 9am to 6pm EST. "
            "Enterprise customers have access to 24/7 priority support via dedicated Slack channel. "
            "Response times: Free tier 72 hours, Pro tier 24 hours, Enterprise tier 4 hours."
        ),
    },
    {
        "id": 4,
        "source": "docs/security.md",
        "text": (
            "All data is encrypted at rest using AES-256. Data in transit is protected by TLS 1.3. "
            "We are SOC 2 Type II certified. Customer data is never sold or shared with third parties. "
            "GDPR and CCPA compliant."
        ),
    },
]


# ─── Step 1: Ingestion ───────────────────────────────────────────────────────

def setup_collection():
    qdrant.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=DIM, distance=Distance.COSINE),
    )
    print(f"[ingestion] Created collection '{COLLECTION}'")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed. Returns parallel list of float vectors."""
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    vectors = [item.embedding for item in resp.data]
    print(f"[ingestion] Embedded {len(texts)} texts → {len(vectors[0])} dims each")
    return vectors


def ingest_documents():
    texts = [doc["text"] for doc in DOCUMENTS]
    vectors = embed_texts(texts)

    points = [
        PointStruct(
            id=doc["id"],
            vector=vec,
            payload={"text": doc["text"], "source": doc["source"]},
        )
        for doc, vec in zip(DOCUMENTS, vectors)
    ]

    qdrant.upsert(collection_name=COLLECTION, points=points)
    print(f"[ingestion] Upserted {len(points)} documents into Qdrant")


# ─── Step 2: Retrieval ───────────────────────────────────────────────────────

def retrieve(query: str, top_k: int = 3) -> list[dict]:
    """Embed query, search Qdrant, return top-k chunks."""
    print(f"\n[retrieval] Query: '{query}'")

    query_vec = client.embeddings.create(model=EMBED_MODEL, input=query).data[0].embedding
    print(f"[retrieval] Embedded query → {len(query_vec)}-dim vector")

    results = qdrant.search(
        collection_name=COLLECTION,
        query_vector=query_vec,
        limit=top_k,
        with_payload=True,
    )

    chunks = []
    for r in results:
        print(f"[retrieval]   score={r.score:.3f} source={r.payload['source']}")
        chunks.append({
            "score": r.score,
            "text": r.payload["text"],
            "source": r.payload["source"],
        })

    return chunks


# ─── Step 3: Generation ──────────────────────────────────────────────────────

def generate(query: str, chunks: list[dict]) -> str:
    """Assemble context and call LLM."""
    # Filter out low-confidence chunks
    relevant_chunks = [c for c in chunks if c["score"] > 0.5]
    if not relevant_chunks:
        return "I don't have relevant information about that in my knowledge base."

    # Assemble context with source labels
    context_parts = []
    for i, chunk in enumerate(relevant_chunks, 1):
        context_parts.append(f"[Source {i}: {chunk['source']}]\n{chunk['text']}")
    context = "\n\n---\n\n".join(context_parts)

    print(f"\n[generation] Using {len(relevant_chunks)} chunk(s) as context")
    print(f"[generation] Calling {LLM_MODEL}...")

    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant. Answer the question using ONLY the provided context. "
                    "If the answer is not in the context, say exactly: \"I don't have information about that.\" "
                    "Do not make up information. Cite the source when possible.\n\n"
                    f"Context:\n{context}"
                ),
            },
            {"role": "user", "content": query},
        ],
    )

    return response.choices[0].message.content


# ─── Main ────────────────────────────────────────────────────────────────────

def rag(query: str) -> str:
    chunks = retrieve(query)
    answer = generate(query, chunks)
    return answer


if __name__ == "__main__":
    print("=== Setting up RAG pipeline ===")
    setup_collection()
    ingest_documents()

    queries = [
        "Can I cancel my monthly subscription?",
        "What are the enterprise support response times?",
        "What encryption does the platform use?",
        "What is the return policy for physical products?",
        "What is the price of the Pro plan?",  # not in docs — should say "I don't have info"
    ]

    print("\n=== Running queries ===")
    for q in queries:
        print(f"\n{'─'*60}")
        answer = rag(q)
        print(f"\n[answer] {answer}")
