from qdrant_client import AsyncQdrantClient
from ..utils.constants import QDRANT_COLLECTION
from ..utils.models import RetrievedChunk
from qdrant_client.models import VectorParams, Distance, Filter


async def get_qdrant_client():
    return AsyncQdrantClient(url="http://localhost:6333")


async def create_collection(collection, vector_size):
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
    return await create_collection(QDRANT_COLLECTION, 1536)


async def upsert_collection(collection: str, vectors, wait: bool = True):
    client = await get_qdrant_client()
    await client.upsert(
        collection_name=collection,
        wait=wait,
        points=vectors,
    )


async def delete_collection_data(collection: str, criteria: Filter):
    client = await get_qdrant_client()
    return await client.delete(
        collection_name=collection,
        points_selector=criteria,
        wait=True,
    )


async def query_collections(
    collection: str,
    query: list[float] = [],
    query_filter: Filter | None = None,
    top_k: int = 3,
    score_threshold: float = 0.0,
):
    client = await get_qdrant_client()
    points = await client.query_points(
        collection_name=collection,
        query=query,
        with_payload=True,
        query_filter=query_filter,
        limit=top_k,
        score_threshold=score_threshold,
    )
    return [
        RetrievedChunk(**p.payload, score=p.score) for p in points.points if p.payload
    ]  # guard against None payload
