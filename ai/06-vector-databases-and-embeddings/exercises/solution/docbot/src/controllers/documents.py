from ..utils.constants import (
    TOKEN_SIZE,
    TEXT_OVERLAP,
    EMBEDDING_MODEL,
    EMBED_BATCH_SIZE,
)
from ..utils.models import EmbedDocsBatch
from ..clients.openai import get_openai_client
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_document(text: str) -> list[str]:
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=TOKEN_SIZE,
        chunk_overlap=TEXT_OVERLAP,
        model_name=EMBEDDING_MODEL,
    )
    return text_splitter.split_text(text)


async def embed_docs_batch(docs: list[str]) -> EmbedDocsBatch:
    all_embeddings = []
    tokens = 0
    for i in range(0, len(docs), EMBED_BATCH_SIZE):
        text = docs[i : i + EMBED_BATCH_SIZE]
        res = await (await get_openai_client()).embeddings.create(
            model=EMBEDDING_MODEL, input=text
        )
        all_embeddings.append([item.embedding for item in res.data])
        tokens += res.usage.total_tokens

    return EmbedDocsBatch(embeddings=all_embeddings, tokens=tokens)
