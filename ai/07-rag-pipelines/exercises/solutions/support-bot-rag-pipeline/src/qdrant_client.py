from qdrant_client import AsyncQdrantClient
from qdrant_client.models import VectorParams, Distance


async def get_qdrant_client():
    return AsyncQdrantClient(url="http://localhost:6333")


async def create_colelction(collection, vector_size):
    client = await get_qdrant_client()
    if not await client.collection_exists(collection):
        await client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(
                distance=Distance.COSINE,
                size=vector_size,
            ),
        )
    return client


async def ensure_support_docs_collection() -> AsyncQdrantClient:
    return await create_colelction("support_docs", 1536)
