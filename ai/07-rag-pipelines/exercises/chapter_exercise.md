# Chapter Exercise — Support Bot RAG Pipeline

## Problem Statement

Build a **support bot backend** for a fictional SaaS product. Given a folder of
markdown documentation files, your system ingests them into a vector store and
exposes a query function that returns a grounded answer with source citations.

This exercise applies **only Chapter 7 concepts**: document loading, chunking,
retrieval, context assembly, and generation. No re-ranking, no hybrid search
(those are Chapter 8).

---

## Acceptance Criteria

- [ ] `ingest(folder_path)` — loads all `.md` files, chunks them, embeds in batch, upserts to Qdrant
- [ ] `query(question, top_k=5)` — retrieves top-k chunks, filters by score, generates answer
- [ ] Generated answer includes inline source citations: `[Source: filename.md]`
- [ ] If no chunks score above 0.55, return a graceful "no information" response (do NOT send low-confidence chunks to LLM)
- [ ] `ingest()` is idempotent: running it twice on the same folder does not duplicate documents (hint: delete by source before re-inserting)
- [ ] All embedding calls are **batched** — no sequential per-chunk calls
- [ ] Context assembly applies "lost in the middle" ordering (most relevant chunk last)

---

## Starter Skeleton

```python
# support_bot.py
"""
Usage:
  python support_bot.py ingest --folder ./docs
  python support_bot.py query --question "What is the refund policy?"
  python support_bot.py query --question "..." --top-k 3
"""

import argparse
import os
from pathlib import Path
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
qdrant = QdrantClient(url=os.environ.get("QDRANT_URL", "http://localhost:6333"))

EMBED_MODEL = "text-embedding-3-small"
LLM_MODEL = "gpt-4o-mini"
COLLECTION = "support_docs"
DIM = 1536
CHUNK_SIZE = 500       # characters
CHUNK_OVERLAP = 60     # characters
SCORE_THRESHOLD = 0.55 # drop chunks below this


def ensure_collection():
    """Create Qdrant collection if it doesn't exist."""
    # TODO: check if collection exists, create if not
    pass


def load_markdown_files(folder: Path) -> list[dict]:
    """
    Load all .md files from folder.
    Return list of dicts: {"source": filename, "text": full_text}
    """
    # TODO: implement
    pass


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split text into overlapping chunks.
    Try to split on paragraph boundaries (\n\n) first, then sentence (\n), then character.
    """
    # TODO: implement recursive-ish splitting
    # Hint: find the last \n\n before chunk_size, or last \n, or just cut at chunk_size
    pass


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of texts in one or more API calls (max 2048 per call).
    Return list of float vectors.
    """
    # TODO: implement with batching
    pass


def delete_by_source(source: str):
    """Delete all vectors with this source filename (for idempotency)."""
    # TODO: use qdrant.delete() with a Filter on the "source" payload field
    pass


def ingest(folder: Path):
    """Load, chunk, embed, and upsert all .md files in folder."""
    ensure_collection()
    docs = load_markdown_files(folder)

    all_chunks = []
    for doc in docs:
        # TODO: delete existing vectors for this source (idempotency)
        chunks = chunk_text(doc["text"])
        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "source": doc["source"],
                "chunk_index": i,
                "text": chunk,
            })

    if not all_chunks:
        print("No documents found.")
        return

    print(f"[ingest] {len(docs)} files → {len(all_chunks)} chunks")

    # TODO: extract texts, embed in batch, build PointStructs, upsert to Qdrant
    pass


def retrieve(question: str, top_k: int) -> list[dict]:
    """
    Embed question, search Qdrant, return chunks above SCORE_THRESHOLD.
    Each result: {"score": float, "text": str, "source": str}
    """
    # TODO: implement
    pass


def assemble_context(chunks: list[dict]) -> str:
    """
    Format chunks into a context string with source labels.
    Apply lost-in-the-middle ordering: most relevant chunk goes LAST.
    """
    # TODO: implement
    # Hint: reverse the list so rank-1 (most relevant) is at the end
    pass


def generate_answer(question: str, context: str) -> str:
    """Call LLM with context and question, return answer string."""
    # TODO: implement
    # System prompt must instruct LLM to use ONLY the context
    # and say "I don't have information" if the answer isn't there
    pass


def query(question: str, top_k: int = 5) -> str:
    """Full RAG pipeline: retrieve → filter → assemble → generate."""
    chunks = retrieve(question, top_k)

    if not chunks:
        return "I don't have relevant information about that in my knowledge base."

    context = assemble_context(chunks)
    answer = generate_answer(question, context)
    return answer


def main():
    parser = argparse.ArgumentParser(description="Support Bot RAG Pipeline")
    subparsers = parser.add_subparsers(dest="command")

    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("--folder", required=True)

    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--question", required=True)
    query_parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    if args.command == "ingest":
        ingest(Path(args.folder))
    elif args.command == "query":
        answer = query(args.question, args.top_k)
        print(f"\nAnswer: {answer}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
```

---

## Sample Document Folder

Create `./docs/` with these three files to test your implementation:

**`docs/billing.md`**
```markdown
# Billing & Payments

Monthly plans are billed on the same day each month. Annual plans are billed once per year.

## Failed Payments
If a payment fails, we retry 3 times over 7 days. After 3 failed attempts, the account is downgraded to the Free tier.

## Invoice Access
Invoices are available in Account Settings > Billing > Invoice History.
```

**`docs/cancellation.md`**
```markdown
# Cancellation Policy

Monthly subscribers can cancel at any time. Cancellation takes effect at the end of the current billing period.

Annual subscribers who cancel within 14 days of renewal receive a full refund. After 14 days, no refund is issued.

To cancel: Account Settings > Subscription > Cancel Plan.
```

**`docs/support.md`**
```markdown
# Support & SLAs

## Response Times
- Free tier: 72 hours
- Pro tier: 24 hours
- Enterprise: 4 hours (24/7)

## Contact
Email: support@example.com
Enterprise customers: Use the dedicated Slack channel provided at onboarding.
```

---

## Hints

<details>
<summary>Hint 1: Idempotent ingestion — how to delete by source</summary>

Qdrant lets you delete by a filter on payload fields:

```python
from qdrant_client.models import Filter, FieldCondition, MatchValue

qdrant.delete(
    collection_name=COLLECTION,
    points_selector=Filter(
        must=[FieldCondition(key="source", match=MatchValue(value=source_filename))]
    )
)
```

Call this before upserting new chunks for that file.
</details>

<details>
<summary>Hint 2: Generating chunk IDs deterministically</summary>

Use a hash of (source + chunk_index) for the Qdrant point ID:

```python
import hashlib
def chunk_id(source: str, index: int) -> str:
    return hashlib.md5(f"{source}:{index}".encode()).hexdigest()
```

Use this as the `id` field in `PointStruct`. This makes upserts idempotent
even if you don't do the delete step.
</details>

<details>
<summary>Hint 3: Check collection existence</summary>

```python
existing = [c.name for c in qdrant.get_collections().collections]
if COLLECTION not in existing:
    qdrant.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=DIM, distance=Distance.COSINE),
    )
```
</details>

<details>
<summary>Hint 4: Lost-in-the-middle ordering</summary>

After retrieving and filtering chunks (sorted by score, highest first),
reverse the list for context assembly:

```python
ordered = list(reversed(filtered_chunks))  # rank-1 (highest score) goes LAST
```

Then format as:
```
[Source 1: billing.md]
Monthly plans are billed...

---

[Source 2: cancellation.md]
Monthly subscribers can cancel...
```
</details>

---

## What to Verify

- [ ] `python support_bot.py ingest --folder ./docs` shows chunk count and "Upserted N points"
- [ ] Running ingest twice does not double the chunk count in Qdrant
- [ ] `python support_bot.py query --question "Can I cancel monthly?"` returns a grounded answer citing `cancellation.md`
- [ ] A question about something not in the docs returns "I don't have relevant information..."
- [ ] Embedding is batched: confirm by adding a print inside `embed_batch()` showing how many texts per API call
- [ ] Answer includes `[Source: ...]` citation

---

## Prediction Exercise

Before running your implementation, answer these:

1. If you set `SCORE_THRESHOLD = 0.80`, what do you predict will happen for a very specific query like "what happens after 3 failed payments"?

2. If you have 5 chunks in context but only 1 is truly relevant, and your system prompt says "answer ONLY from the context" — do you expect the LLM to always stay on topic, or sometimes drift? What determines this?

Run it and compare your prediction to the actual behavior.
