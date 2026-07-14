import tiktoken
from ..utils.constants import (
    TOKEN_SIZE,
    TEXT_OVERLAP,
    EMBEDDING_MODEL,
    EMBED_BATCH_SIZE,
)
from ..clients.openai import get_openai_client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ..utils.models import Chunk, EmbedDocsBatch, EmbeddedChunk, DocumentUploadRequest


def chunk_document(document: DocumentUploadRequest, document_id: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    encoding = tiktoken.encoding_for_model(EMBEDDING_MODEL)
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=TOKEN_SIZE,
        chunk_overlap=TEXT_OVERLAP,
        model_name=EMBEDDING_MODEL,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )
    splitted = text_splitter.split_text(document.text)
    for i, chunk in enumerate(splitted):
        token_count = len(encoding.encode(chunk))
        chunks.append(
            Chunk(
                text=chunk,
                token_count=token_count,
                chunk_index=i,
                document_id=document_id,
                name=document.name,
            )
        )
    return chunks


async def embed(text: str) -> tuple[list[float], int]:
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
