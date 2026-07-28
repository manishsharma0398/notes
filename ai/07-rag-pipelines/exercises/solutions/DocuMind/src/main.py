import asyncio
import tiktoken
from uuid import uuid4
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, UTC
from qdrant_client.models import PointStruct, Filter, MatchAny, FieldCondition
from .clients.openai_client import get_openai_client
from .clients.qdrant_client import (
    upsert_collection,
    ensure_support_docs_collection,
    delete_collection_data,
    query_collections,
)
from .utils.models import (
    Chunk,
    CollectionData,
    Document,
    EmbedChunk,
    IndexManifest,
    RetrievedChunk,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .utils.constants import (
    TOKEN_SIZE,
    TEXT_OVERLAP,
    EMBEDDING_MODEL,
    EMBED_BATCH_SIZE,
    QDRANT_COLLECTION,
    EMBEDING_MODEL_COST_PER_MILLION,
    OPENAI_MODEL,
    TEMPERATURE,
    SCORE_THRESHOLD,
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


async def embed(text):
    return await (await get_openai_client()).embeddings.create(
        model=EMBEDDING_MODEL, input=text
    )


async def embed_docs_batch(chunks: list[Chunk]) -> tuple[int, int, list[EmbedChunk]]:
    tokens = 0
    embedded_chunks: list[EmbedChunk] = []
    batch_count = 0

    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch_texts = []

        batch_docs = chunks[i : i + EMBED_BATCH_SIZE]

        for chunk in batch_docs:
            batch_texts.append(chunk.text)

        res = await embed(batch_texts)

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


def lost_in_the_middle_reorder(
    relevant_chunks: list[RetrievedChunk],
) -> list[RetrievedChunk]:
    ranked = sorted(relevant_chunks, key=lambda x: x.score, reverse=True)
    front: list[RetrievedChunk] = []
    back: list[RetrievedChunk] = []
    for i, chunk in enumerate(ranked):
        if i % 2 == 0:
            front.append(chunk)
        else:
            back.append(chunk)
    back.reverse()
    return front + back


def assemble_context(relevant_chunks: list[RetrievedChunk]) -> str:
    context = []
    records = lost_in_the_middle_reorder(relevant_chunks)
    for i, record in enumerate(records):
        src = f"[{i+1}] [Source: {record.src or "Unknown"}]"
        text = record.text or ""
        context.append(f"{src}\n{text}\n")
    return "\n\n\n\n".join(context)


async def generate_answer(question: str, context: str) -> str:
    client = await get_openai_client()
    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=TEMPERATURE,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful support agent for a SaaS product. "
                    "Answer the user's question using ONLY the provided context. "
                    "Each context block is preceded by a bracketed number, e.g. [1] [Source: filename.md]. "
                    "Cite the sources you used inline with their bracketed number, e.g. [1], right after the claim they support. "
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
    return response.choices[0].message.content or "No Results"


async def query():
    question, top_k = "", 5
    emb_question = await embed(question)
    relevant_chunks = await query_collections(
        QDRANT_COLLECTION,
        query=emb_question.data[0].embedding,
        top_k=top_k,
        score_threshold=SCORE_THRESHOLD,
    )
    context = assemble_context(relevant_chunks)
    return await generate_answer(question, context)


async def main():
    pass


async def ingest():
    docs_folder = Path("./docs")
    docs = get_all_files(docs_folder)
    chunks = chunk_docs(docs)
    tokens, batch_count, ebd_chunks = await embed_docs_batch(chunks)
    await ensure_support_docs_collection()
    await delete_collection_data(
        QDRANT_COLLECTION,
        criteria=Filter(
            must=FieldCondition(
                key="src",
                match=MatchAny(any=[i.source for i in docs]),
            ),
        ),
    )
    await upsert_collection(
        QDRANT_COLLECTION,
        vectors=[
            PointStruct(
                id=str(uuid4()),
                vector=embed.embedding,
                payload=CollectionData(
                    text=embed.text,
                    token_count=embed.token_count,
                    chunk_index=embed.chunk_index,
                    src=embed.src,
                    doc_id=embed.doc_id,
                    file_extension=embed.file_extension,
                    file_name=embed.file_name,
                ).model_dump(),
            )
            for embed in ebd_chunks
        ],
    )
    time_now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    file_count = len(docs)
    chunk_count = len(chunks)
    print(
        f"\n{tokens} token consumed while embedding.\nEstimated cost: {calculate_embedding_cost(tokens)}$.\nFiles: {file_count}\nChunks: {chunk_count}\nBatches: {batch_count}\n"
    )
    manifest = IndexManifest(
        collection=QDRANT_COLLECTION,
        model=EMBEDDING_MODEL,
        indexed_at=time_now,
        file_count=file_count,
        chunk_count=chunk_count,
    )
    with open(f"{docs_folder}/index_manifest.json", "w", encoding="utf-8") as d:
        d.write(manifest.model_dump_json(indent=4))


if __name__ == "__main__":
    asyncio.run(main())
