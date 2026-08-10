# Chapter Exercise — Semantic Document Search CLI

## Problem Statement

Build a command-line semantic search tool. Given a folder of `.txt` or `.md` files,
the tool indexes them into a local vector store and lets you interactively search
with natural language queries.

This exercise applies **only** Chapter 6 concepts: embeddings, chunking, and
similarity search. No LLM answer generation — retrieval only.

---

## Acceptance Criteria

- [ ] CLI accepts a `--index <folder>` argument to ingest all `.txt`/`.md` files in a directory
- [ ] CLI accepts a `--query "<question>"` argument for one-shot search
- [ ] CLI accepts interactive mode (no `--query` flag): reads queries from stdin in a loop
- [ ] Documents are chunked before embedding (configurable `--chunk-size`, default 400)
- [ ] Embedding uses OpenAI `text-embedding-3-small` with **batched API calls** (never 1 call per chunk)
- [ ] Results show: score, source filename, chunk preview (first 150 chars)
- [ ] Top-k configurable via `--top-k` flag (default 3)
- [ ] The index is **persisted to disk** between runs (re-indexing same folder skips files that haven't changed, or at minimum: save and reload without re-embedding)

---

## Starter Skeleton

```python
# semantic_search.py
"""
Usage:
  python semantic_search.py --index ./docs
  python semantic_search.py --index ./docs --query "how do I reset my password"
  python semantic_search.py --index ./docs --query "..." --top-k 5
"""

import argparse
import os
import json
import numpy as np
from pathlib import Path
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
INDEX_FILE = ".semantic_index.json"  # persisted index in the docs folder


def load_documents(folder: Path) -> list[dict]:
    """
    Load all .txt and .md files from folder.
    Return list of dicts: {"source": filename, "text": full_text}
    # TODO: implement
    """
    pass


def chunk_document(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Split text into overlapping chunks by character count.
    Try to split on sentence boundaries if possible.
    # TODO: implement
    """
    pass


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Call OpenAI embeddings API with a batch of texts.
    Handle the case where texts is larger than 2048 (API limit per call).
    # TODO: implement — remember to split into sub-batches if needed
    """
    pass


def build_index(documents: list[dict], chunk_size: int) -> dict:
    """
    Chunk all documents, embed in batch, return index dict:
    {
      "chunks": [{"text": ..., "source": ..., "chunk_index": ...}, ...],
      "embeddings": [[float, ...], ...],    # parallel list to chunks
      "model": EMBEDDING_MODEL,
    }
    # TODO: implement
    """
    pass


def save_index(index: dict, path: Path):
    """Save index to JSON file. # TODO: implement"""
    pass


def load_index(path: Path) -> dict | None:
    """Load index from JSON file. Return None if not found. # TODO: implement"""
    pass


def search(query: str, index: dict, top_k: int) -> list[tuple[float, dict]]:
    """
    Embed query, compute cosine similarity against all index embeddings,
    return top_k results as list of (score, chunk_dict).
    # TODO: implement
    """
    pass


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """# TODO: implement"""
    pass


def main():
    parser = argparse.ArgumentParser(description="Semantic document search")
    parser.add_argument("--index", type=str, required=True, help="Folder to index")
    parser.add_argument("--query", type=str, help="Search query (omit for interactive mode)")
    parser.add_argument("--chunk-size", type=int, default=400)
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--reindex", action="store_true", help="Force re-embedding even if index exists")
    args = parser.parse_args()

    folder = Path(args.index)
    index_path = folder / INDEX_FILE

    # TODO: Load existing index or build a new one
    # TODO: If --reindex flag set, always rebuild

    # TODO: If --query provided, run single query and print results
    # TODO: Else, enter interactive loop reading from stdin

    pass


if __name__ == "__main__":
    main()
```

---

## Hints

<details>
<summary>Hint 1: Handling the 2048 input limit per embedding API call</summary>

OpenAI's API accepts at most 2048 texts per call. If your corpus has more chunks, split
the list into batches of 2048 and loop:

```python
BATCH_SIZE = 2048
all_embeddings = []
for i in range(0, len(texts), BATCH_SIZE):
    batch = texts[i:i + BATCH_SIZE]
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
    all_embeddings.extend([item.embedding for item in resp.data])
```
</details>

<details>
<summary>Hint 2: Persisting the index</summary>

JSON can't natively store numpy arrays, but plain Python lists work fine:

```python
# Save
with open(path, "w") as f:
    json.dump({"chunks": chunks, "embeddings": embeddings, "model": EMBEDDING_MODEL}, f)

# Load
with open(path, "r") as f:
    return json.load(f)
```

For large corpora, consider `numpy.save()` for embeddings (faster, smaller file) and a
separate JSON for metadata.
</details>

<details>
<summary>Hint 3: Cosine similarity when vectors are already L2-normalized</summary>

OpenAI returns L2-normalized vectors, so cosine similarity = dot product.
For brute-force over a small corpus, use numpy matrix multiply for efficiency:

```python
# query_vec: shape (1536,)
# embeddings: shape (n_chunks, 1536)
query_arr = np.array(query_vec)
embed_matrix = np.array(embeddings)
scores = embed_matrix @ query_arr  # dot product for each chunk
top_k_indices = np.argsort(scores)[::-1][:top_k]
```
</details>

<details>
<summary>Hint 4: Detecting changed files for smart re-index</summary>

Store a file modification timestamp map alongside the index:

```python
file_mtimes = {str(f): f.stat().st_mtime for f in folder.glob("**/*.md")}
```

On next run, compare stored mtimes to current. Only re-embed files that changed.
This is optional — full re-index is acceptable for the exercise.
</details>

---

## What to Verify

- [ ] Running `--index ./docs` produces console output showing chunk count and "Index saved"
- [ ] Running `--query "..."` with an existing index does NOT re-embed (reuses saved index)
- [ ] Results are ordered by score (highest first)
- [ ] A query about a topic in file A does not return results from file B (unless genuinely relevant)
- [ ] Batch embedding is used: confirm with a print statement showing batch sizes, not one call per chunk
- [ ] The CLI doesn't crash on empty files or files with only whitespace
- [ ] `--top-k 1` returns exactly 1 result
- [ ] Interactive mode prompts for input and shows results in a loop until `quit` or `exit`

---

## Prediction Exercise (answer before running)

You have 3 documents:
- `auth.md`: 800 characters about password reset and login
- `billing.md`: 800 characters about invoices and payments
- `shipping.md`: 800 characters about delivery times

With `--chunk-size 200`, each document produces ~4 chunks.

**Predict:** What score range would you expect for a relevant hit vs. an irrelevant one?
**Predict:** If you set `--chunk-size 800` (one chunk per document), how would retrieval quality change for a specific query like "what happens after 5 failed login attempts?"

Run the experiment and compare your prediction to the actual scores.
