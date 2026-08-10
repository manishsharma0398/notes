"""
Example 1: Embedding text and computing similarity from scratch
Shows exactly what happens under the hood — no LangChain abstraction.
Dependencies: openai, numpy
Run: python 01_embeddings_raw.py
"""

import os
import numpy as np
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

EMBEDDING_MODEL = "text-embedding-3-small"


def embed(text: str) -> list[float]:
    """
    Single text embedding call. Returns raw float list.
    Under the hood: tokenize → transformer → pool hidden states → L2 normalize.
    """
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
        # encoding_format="float" is the default
    )
    return response.data[0].embedding


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Batch embedding. OpenAI accepts up to 2048 inputs per call.
    Always use this in production — not a loop of single embed() calls.
    """
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    # Response preserves input order
    return [item.embedding for item in response.data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    After L2 normalization (which OpenAI does internally), this equals dot product.
    Range: -1 to 1. Higher = more similar.
    """
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


def main():
    # ---------------------------------------------------------
    # 1. Embed some semantically related and unrelated phrases
    # ---------------------------------------------------------
    texts = [
        "How do I reset my password?",           # query
        "I forgot my account password",           # semantically similar
        "Steps to change your login credentials", # related but different phrasing
        "What is the refund policy?",             # unrelated topic
        "Can I get my money back for a purchase?",# unrelated topic
    ]

    print("Embedding batch of texts...")
    embeddings = embed_batch(texts)

    query_vec = embeddings[0]
    print(f"\nQuery: '{texts[0]}'")
    print(f"Embedding dimensions: {len(query_vec)}")  # Should be 1536
    print(f"L2 norm (should be ~1.0): {np.linalg.norm(query_vec):.6f}")

    # ---------------------------------------------------------
    # 2. Compute cosine similarity of query vs. all others
    # ---------------------------------------------------------
    print("\nCosine similarities vs query:")
    for i, (text, vec) in enumerate(zip(texts[1:], embeddings[1:]), start=1):
        sim = cosine_similarity(query_vec, vec)
        print(f"  {sim:.4f}  '{text}'")

    # Expected: first two items (related to password) score higher than refund items
    # This demonstrates that cosine similarity captures semantic proximity.

    # ---------------------------------------------------------
    # 3. Show the effect of L2 normalization
    # ---------------------------------------------------------
    print("\n--- Verifying OpenAI returns L2-normalized vectors ---")
    raw_vec = embeddings[0]
    norm = np.linalg.norm(raw_vec)
    print(f"Magnitude of returned vector: {norm:.6f}")
    # Because it's already normalized: dot product == cosine similarity
    dot = float(np.dot(np.array(embeddings[0]), np.array(embeddings[1])))
    cos = cosine_similarity(embeddings[0], embeddings[1])
    print(f"Dot product:        {dot:.6f}")
    print(f"Cosine similarity:  {cos:.6f}")
    print(f"Are they equal? {abs(dot - cos) < 1e-5}")


if __name__ == "__main__":
    main()
