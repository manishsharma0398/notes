import asyncio
import argparse
import tiktoken
from uuid import uuid4
from pathlib import Path
from .openai_client import get_openai_client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .models import IngestedDoc, Chunk, EmbeddedChunk, EmbedDocsBatch
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchAny
from .qdrant_client import (
    ensure_support_docs_collection,
    upsert_collection,
    delete_collection_data,
    query_collections,
)
from .constants import (
    EMBED_BATCH_SIZE,
    EMBEDDING_MODEL,
    TEXT_OVERLAP,
    TOKEN_SIZE,
    SUPPORT_DOCS_COLLECTION,
    SCORE_THRESHOLD,
)


def chunk_document(document: list[IngestedDoc]) -> list[Chunk]:
    chunks: list[Chunk] = []
    encoding = tiktoken.encoding_for_model(EMBEDDING_MODEL)
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=TOKEN_SIZE,
        chunk_overlap=TEXT_OVERLAP,
        model_name=EMBEDDING_MODEL,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )
    for doc in document:
        doc_id = str(uuid4())
        splitted = text_splitter.split_text(doc.text)
        for i, chunk in enumerate(splitted):
            token_count = len(encoding.encode(chunk))
            chunks.append(
                Chunk(
                    text=chunk,
                    token_count=token_count,
                    chunk_index=i,
                    document_id=doc_id,
                    src=doc.source,
                )
            )
    return chunks


def get_md_files(path: Path) -> list[IngestedDoc]:
    docs: list[IngestedDoc] = []
    for file_path in path.rglob("*.md"):
        content = file_path.read_text(encoding="utf-8")
        docs.append(
            IngestedDoc(
                source=file_path.name,
                text=content,
            )
        )
    return docs


async def embed_question(text: str) -> tuple[list[float], int]:
    res = await (await get_openai_client()).embeddings.create(
        model=EMBEDDING_MODEL, input=[text]
    )
    return res.data[0].embedding, res.usage.total_tokens


async def embed_docs_batch(docs: list[Chunk]):
    tokens = 0
    # chunk_tokens = 0
    embedded_chunks: list[EmbeddedChunk] = []

    for i in range(0, len(docs), EMBED_BATCH_SIZE):
        batch_texts = []

        batch_docs = docs[i : i + EMBED_BATCH_SIZE]

        for chunk in batch_docs:
            batch_texts.append(chunk.text)
            # chunk_tokens += chunk.token_count

        res = await (await get_openai_client()).embeddings.create(
            model=EMBEDDING_MODEL, input=batch_texts
        )

        for chunk, embedding in zip(batch_docs, res.data):
            embedded_chunks.append(
                EmbeddedChunk(
                    **chunk.model_dump(),
                    embedding=embedding.embedding,
                )
            )

        tokens += res.usage.total_tokens

    return EmbedDocsBatch(
        embedded_chunks=embedded_chunks,
        tokens=tokens,
    )


async def ingest(path: Path):
    docs = get_md_files(path)
    if not docs:
        print("no documents found")
        return
    await ensure_support_docs_collection()
    await delete_collection_data(
        SUPPORT_DOCS_COLLECTION,
        criteria=Filter(
            must=FieldCondition(
                key="source",
                match=MatchAny(any=[i.source for i in docs]),
            ),
        ),
    )
    chunked_documents = chunk_document(docs)
    print(f"[ingest] {len(docs)} files → {len(chunked_documents)} chunks")
    embeddings = await embed_docs_batch(chunked_documents)
    await upsert_collection(
        collection=SUPPORT_DOCS_COLLECTION,
        vectors=[
            PointStruct(
                id=str(uuid4()),
                vector=embed.embedding,
                payload={
                    "text": embed.text,
                    "token_count": embed.token_count,
                    "chunk_index": embed.chunk_index,
                    "source": embed.src,
                    "document_id": embed.document_id,
                },
            )
            for embed in embeddings.embedded_chunks
        ],
    )


async def retrieve(question: str, top_k: int) -> list[dict]:
    """
    Embed question, search Qdrant, return chunks above SCORE_THRESHOLD.
    Each result: {"score": float, "text": str, "source": str}
    """
    q_emb, _ = await embed_question(question)
    return await query_collections(
        collection=SUPPORT_DOCS_COLLECTION,
        query=q_emb,
        query_filter=None,
        top_k=top_k,
        score_threshold=SCORE_THRESHOLD,
    )


def assemble_context(chunks) -> str:
    """
    Format chunks into a context string with source labels.
    Apply lost-in-the-middle ordering: most relevant chunk goes LAST.
    """
    context_parts = []
    # sort ascending by score so rank-1 (highest) ends up LAST
    sorted_chunks = sorted(chunks, key=lambda x: x["score"])
    for i, doc in enumerate(sorted_chunks, 1):
        source = doc.get("source", "unknown")
        text = doc.get("text", "")
        context_parts.append(f"[Source {i}: {source}]\n{text}")

    return "\n\n---\n\n".join(context_parts)


async def generate_answer(question: str, context: str) -> str:
    """Call LLM with context and question, return answer string."""
    openai_client = await get_openai_client()
    answer = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful support agent for a SaaS product. "
                    "Answer the user's question using ONLY the provided context. "
                    "Always include the source citation in the format [Source: filename.md] at the end of your answer. "
                    "If the context does not contain the answer, respond with: "
                    "'I don't have relevant information about that in my knowledge base.'"
                ),
            },
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
    )
    return answer.choices[0].message.content


async def query(question, top_k):
    points = await retrieve(question, top_k)
    if not points:
        return "I don't have relevant information about that."
    context = assemble_context(points)
    return await generate_answer(question, context)


async def main():
    parser = argparse.ArgumentParser(description="Support Bot RAG Pipeline")
    subparsers = parser.add_subparsers(dest="command")

    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("--folder", required=True)

    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--question", required=True)
    query_parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    if args.command == "ingest":
        await ingest(Path(args.folder))
    elif args.command == "query":
        answer = await query(args.question, args.top_k)
        print(f"\nAnswer: {answer}")
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
