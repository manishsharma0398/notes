import numpy as np
import re
import json
import argparse
from openai import OpenAI
from pathlib import Path
from dotenv import load_dotenv


from utils.constants import INDEX_FILE, EMBEDDING_MODEL, BATCH_SIZE

load_dotenv()

client = OpenAI()


def load_documents(folder: Path) -> list[dict]:
    documents = []
    for ext in ("*.txt", "*.md"):
        for path in folder.glob(f"**/{ext}"):
            if path.is_file():
                try:
                    text = path.read_text(encoding="utf-8")
                    documents.append(
                        {
                            "source": str(path.relative_to(folder)),
                            "text": text,
                        }
                    )
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    return documents


def chunk_documents(text: str, chunk_size: int, overlap: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current_chunk = []
    current_len = 0

    for sentence in sentences:
        if not sentence.strip():
            continue
        sentence_len = len(sentence)

        # If sentence alone exceeds limit, split by chars
        if sentence_len > chunk_size:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_len = 0
            start = 0
            while start < sentence_len:
                chunks.append(sentence[start : start + chunk_size])
                start += chunk_size - overlap
            continue

        # If fits in current chunk, add it
        if current_len + sentence_len + (1 if current_chunk else 0) <= chunk_size:
            current_chunk.append(sentence)
            current_len += sentence_len + (1 if len(current_chunk) > 1 else 0)
        else:
            # Save full chunk
            chunks.append(" ".join(current_chunk))

            # Backtrack for overlap
            overlap_chunk = []
            overlap_len = 0
            for prev in reversed(current_chunk):
                prev_len = len(prev)
                if overlap_len + prev_len + (1 if overlap_chunk else 0) <= overlap:
                    overlap_chunk.insert(0, prev)
                    overlap_len += prev_len + (1 if len(overlap_chunk) > 1 else 0)
                else:
                    break

            current_chunk = overlap_chunk + [sentence]
            current_len = overlap_len + sentence_len + (1 if overlap_chunk else 0)

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def embed_batch(texts: list[str]):
    all_embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        resp = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        all_embeddings.extend([item.embedding for item in resp.data])
    return all_embeddings


def build_index(documents: list[dict], chunk_size: int, overlap: int):
    chunks = []
    for doc in documents:
        doc_chunks = chunk_documents(doc["text"], chunk_size, overlap)
        for idx, text in enumerate(doc_chunks):
            chunks.append(
                {
                    "text": text,
                    "source": doc["source"],
                    "chunk_index": idx,
                }
            )

    # Embed all chunks in a single batched call
    texts_to_embed = [c["text"] for c in chunks]
    embeddings = embed_batch(texts_to_embed) if texts_to_embed else []

    return {
        "chunks": chunks,
        "embeddings": embeddings,
        "model": EMBEDDING_MODEL,
    }


def save_index(index: dict, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)


def load_index(path: Path) -> dict | None:
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    # OpenAI embeddings are L2 normalized. Cosine similarity = dot product.
    return float(np.dot(a, b))


def search(query: str, index: dict, top_k: int) -> list[tuple[float, dict]]:
    query_vector = embed_batch([query])[0]

    # Use numpy matrix multiplication for speed
    embed_matrix = np.array(index["embeddings"])  # shape: (N, 1536)
    query_arr = np.array(query_vector)  # shape: (1536,)

    scores = np.dot(embed_matrix, query_arr)

    results = []
    for idx, score in enumerate(scores):
        results.append((float(score), index["chunks"][idx]))

    # Sort descending by score
    results.sort(key=lambda x: x[0], reverse=True)
    return results[:top_k]


def print_results(results):
    for score, chunk in results:
        text_preview = chunk["text"][:150].replace("\n", " ")
        print(
            f"\n[Score: {score:.4f}] {chunk['source']} (Chunk {chunk['chunk_index']})"
        )
        print(f"  Preview: {text_preview}...")


def main():

    parser = argparse.ArgumentParser(description="Semantic document search")

    parser.add_argument("--index", type=str, required=True, help="Folder to index")
    parser.add_argument(
        "--query", type=str, help="Search query (omit for interactive mode)"
    )
    parser.add_argument("--chunk-size", type=int, default=400, help="Chunk size")
    parser.add_argument("--top-k", type=int, default=3, help="Top-k")
    parser.add_argument(
        "--reindex",
        action="store_true",
        help="Force re-embedding even if index exists",
    )

    args = parser.parse_args()
    folder = Path(args.index)

    if not folder.exists() or not folder.is_dir():
        print(f"Error: Directory '{folder}' does not exist.")
        return

    index_path = folder / INDEX_FILE
    overlap = args.chunk_size // 10

    # Load or build index
    index = None
    if not args.reindex:
        index = load_index(index_path)
        if index:
            print("Loaded existing index from disk.")
    if not index:
        print("Building new index...")
        documents = load_documents(folder)
        if not documents:
            print("No text or markdown files found to index.")
            return
        index = build_index(documents, args.chunk_size, overlap)
        save_index(index, index_path)
        print(f"Index built and saved to {index_path}.")

    # Single-shot query mode
    if args.query:
        print(f"Searching for: '{args.query}'")
        results = search(args.query, index, args.top_k)
        print_results(results)
    else:
        # Interactive mode
        print("\nEntering interactive mode. Type 'exit' or 'quit' to stop.")
        while True:
            try:
                query = input("\nSearch query > ").strip()
                if not query:
                    continue
                if query.lower() in ("exit", "quit"):
                    break
                results = search(query, index, args.top_k)
                print_results(results)
            except (KeyboardInterrupt, EOFError):
                print()
                break


if __name__ == "__main__":
    main()
