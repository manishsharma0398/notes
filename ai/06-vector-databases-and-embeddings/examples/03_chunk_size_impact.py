"""
Example 3: Chunk size impact on retrieval quality
Demonstrates HOW chunk size affects what gets retrieved.
No vector DB needed — uses brute-force cosine search over a small corpus.
Dependencies: openai, numpy
Run: python 03_chunk_size_impact.py
"""

import os
import numpy as np
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
EMBEDDING_MODEL = "text-embedding-3-small"

# A realistic document: multiple unrelated sections
DOCUMENT = """
Section 1: Password Reset
To reset your password, navigate to the login page and click the "Forgot Password" link.
Enter your registered email address and submit the form.
You will receive an email with a reset link. The link expires in 24 hours.

Section 2: Billing and Subscriptions
Your subscription renews automatically every month. You can cancel at any time from the
Billing section of your account settings. Refunds are not provided for partial months.
To update your payment method, go to Account > Billing > Payment Methods.

Section 3: Account Security
Enable two-factor authentication from Security Settings for extra protection.
We recommend using an authenticator app rather than SMS. Recovery codes should be
printed and stored securely. Contact support if you are locked out of your account.

Section 4: Data Export
You can export all your data at any time. Go to Settings > Privacy > Export Data.
The export includes all your projects, files, and account history. The download link
is valid for 7 days. Large accounts may take up to 24 hours to prepare the export.
"""


def embed_batch(texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in resp.data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def chunk_by_chars(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Simple fixed-size character chunking."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if c]


def search_chunks(query_vec: list[float], chunks: list[str], chunk_vecs: list[list[float]], top_k: int = 2):
    scores = [(cosine_similarity(query_vec, cv), chunk) for cv, chunk in zip(chunk_vecs, chunks)]
    scores.sort(reverse=True)
    return scores[:top_k]


def main():
    query = "How do I reset my password?"
    print(f"Query: '{query}'\n")
    print("="*65)

    [query_vec] = embed_batch([query])

    for chunk_size in [100, 300, 800]:
        chunks = chunk_by_chars(DOCUMENT, chunk_size=chunk_size, overlap=chunk_size // 10)
        vecs = embed_batch(chunks)

        top = search_chunks(query_vec, chunks, vecs, top_k=1)
        score, best_chunk = top[0]

        print(f"\nChunk size = {chunk_size} chars → {len(chunks)} chunks")
        print(f"  Best match score: {score:.4f}")
        print(f"  Best chunk text preview:\n    '{best_chunk[:200]}'")

    # Key observation to notice:
    # - Small chunks (100 chars): may split mid-sentence, weak signal but precise
    # - Medium chunks (300 chars): best balance — captures full paragraph, strong match
    # - Large chunks (800 chars): single chunk covers multiple sections — "averaged out"
    #   signal may pull in billing/security content you don't want
    print("\n--- Engineering insight ---")
    print("Large chunks dilute the embedding signal — one vector represents many topics.")
    print("Retrieve too large a chunk → LLM gets irrelevant context noise.")
    print("Retrieve too small a chunk → missing context for a useful answer.")


if __name__ == "__main__":
    main()
