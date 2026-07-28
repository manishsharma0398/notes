import argparse
import sys
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


SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful support agent for a SaaS product. "
        "Answer the user's question using ONLY the provided context. "
        "Each context block is preceded by a bracketed number, e.g. [1] [Source: filename.md]. "
        "Cite the sources you used inline with their bracketed number, e.g. [Source: filename.md], right after the claim they support. "
        "If the context does not contain the answer, respond with: "
        "'I don't have relevant information about that in my knowledge base.'"
    ),
}


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


async def generate_answer(messages, stream: bool = False) -> str:
    client = await get_openai_client()
    if stream:
        full = ""
        print("Assistant: ", end="")
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=TEMPERATURE,
            stream=True,
            messages=messages,
        )
        async for ans in response:
            chunk = ans.choices[0].delta.content or ""
            print(chunk, end="", flush=True)
            full += chunk
        print()
        return full
    else:
        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            temperature=TEMPERATURE,
            stream=False,
            messages=messages,
        )
        return response.choices[0].message.content or "No Results"


def user_question_in_chat():
    return str(input("DocuMind > ")).strip()


def ask_user_question():
    try:
        user_msg = user_question_in_chat()
        while not user_msg:
            print("Please enter a proper question or query.")
            user_msg = user_question_in_chat()
        if user_msg.lower() == "exit":
            print("Exiting\n")
            sys.exit(0)
        return user_msg
    except (KeyboardInterrupt, EOFError):
        print("\nExiting DocuMind.")
        sys.exit(0)


async def chat():
    messages = [SYSTEM_PROMPT]
    history = []
    while True:
        print()
        user_msg = ask_user_question()

        if user_msg.lower() == "clear":
            history = []
            print("DocuMind > history cleared")
        elif user_msg.lower() == "sources":
            pass
        else:
            emb_question = await embed(user_msg)
            relevant_chunks = await query_collections(
                QDRANT_COLLECTION,
                query=emb_question.data[0].embedding,
                score_threshold=SCORE_THRESHOLD,
                top_k=5,
            )
            context = assemble_context(relevant_chunks)
            history.append(
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {user_msg}",
                },
            )
            answer = await generate_answer(messages=messages + history, stream=True)
            history.append({"role": "assistant", "content": answer})
            history = history[-4:]


async def query(question, top_k=5):
    emb_question = await embed(question)
    relevant_chunks = await query_collections(
        QDRANT_COLLECTION,
        query=emb_question.data[0].embedding,
        top_k=top_k,
        score_threshold=SCORE_THRESHOLD,
    )
    context = assemble_context(relevant_chunks)
    return await generate_answer(
        messages=[
            SYSTEM_PROMPT,
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ]
    )


async def ingest(docs_folder):
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


async def main():
    parser = argparse.ArgumentParser(description="Documind")
    subparsers = parser.add_subparsers(dest="command")

    ingest_parser = subparsers.add_parser("ingest")
    ingest_parser.add_argument("--folder", required=True)

    subparsers.add_parser("chat")

    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--question", required=True)
    query_parser.add_argument("--top-k", type=int, default=5)

    args = parser.parse_args()

    if args.command == "ingest":
        await ingest(Path(args.folder))
    elif args.command == "query":
        answer = await query(args.question, args.top_k)
        print(f"\nAnswer: {answer}")
    elif args.command == "chat":
        await chat()
    else:
        parser.print_help()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting DocuMind.")
        sys.exit(0)
