import json
import asyncio
import tiktoken
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, UTC
from .clients.openai_client import get_openai_client
from .utils.models import Chunk, Document, EmbedChunk
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .utils.constants import (
    TOKEN_SIZE,
    TEXT_OVERLAP,
    EMBEDDING_MODEL,
    EMBED_BATCH_SIZE,
    QDRANT_COLLECTION,
    EMBEDING_MODEL_COST_PER_MILLION,
)

load_dotenv()


def chunk_docs(docs: list[Document]) -> list[Chunk]:
    chunks = []
    encoding = tiktoken.encoding_for_model(EMBEDDING_MODEL)
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=TOKEN_SIZE,
        chunk_overlap=TEXT_OVERLAP,
        model_name=EMBEDDING_MODEL,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )
    for doc in docs:
        doc_id = str(doc.document_id)
        src = doc.source
        file_extension = doc.extension
        file_name = doc.filename
        splitted = text_splitter.split_text(doc.text)
        for i, chunk in enumerate(splitted):
            token_count = len(encoding.encode(chunk))
            chunks.append(
                Chunk(
                    text=chunk,
                    token_count=token_count,
                    chunk_index=i,
                    doc_id=doc_id,
                    src=src,
                    file_extension=file_extension,
                    file_name=file_name,
                )
            )
    return chunks


def get_all_files(path: Path) -> list[Document]:
    if not path:
        raise ValueError("Path required")
    docs: list[Document] = []
    for pattern in ("*.md", "*.txt"):
        for file_path in path.rglob(pattern):
            docs.append(
                Document(
                    source=str(file_path.relative_to(path)),
                    filename=file_path.name,
                    extension=file_path.suffix,
                    text=file_path.read_text(encoding="utf-8"),
                )
            )
    return docs


async def embed_docs_batch(chunks: list[Chunk]) -> tuple[int, int, list[EmbedChunk]]:
    tokens = 0
    embedded_chunks: list[EmbedChunk] = []
    batch_count = 0

    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch_texts = []

        batch_docs = chunks[i : i + EMBED_BATCH_SIZE]

        for chunk in batch_docs:
            batch_texts.append(chunk.text)

        res = await (await get_openai_client()).embeddings.create(
            model=EMBEDDING_MODEL, input=batch_texts
        )

        for chunk, embedding in zip(batch_docs, res.data):
            embedded_chunks.append(
                EmbedChunk(
                    **chunk.model_dump(),
                    embedding=embedding.embedding,
                )
            )

        tokens += res.usage.total_tokens
        batch_count += 1

    return (tokens, batch_count, embedded_chunks)


def calculate_embedding_cost(tokens_count: int):
    return f"{(tokens_count / 1000000) * EMBEDING_MODEL_COST_PER_MILLION:.6f}"


async def main():
    docs_folder = Path("./docs")
    docs = get_all_files(docs_folder)
    chunks = chunk_docs(docs)
    tokens, batch_count, ebd_chunks = await embed_docs_batch(chunks)
    # TODO: upsert to qdrant with idempotency
    time_now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    file_count = len(docs)
    chunk_count = len(chunks)
    print(
        f"\n{tokens} token consumed while embedding.\nEstimated cost: {calculate_embedding_cost(tokens)}$.\nFiles: {file_count}\nChunks: {chunk_count}\nBatches: {batch_count}\n"
    )
    with open(f"{docs_folder}/index_manifest.json", "w", encoding="utf-8") as d:
        d.write(
            json.dumps(
                {
                    "collection": QDRANT_COLLECTION,
                    "model": EMBEDDING_MODEL,
                    "indexed_at": time_now,
                    "file_count": file_count,
                    "chunk_count": chunk_count,
                },
                indent=4,
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
