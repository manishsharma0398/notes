from qdrant_client import AsyncQdrantClient
from ..utils.models import SearchResult
from qdrant_client.models import Distance, VectorParams, Filter


async def get_qdrant_client():
    # return AsyncQdrantClient(location=":memory:")
    return AsyncQdrantClient(url="http://localhost:6333")


async def create_collection(collection: str, vector_size: int):
    client = await get_qdrant_client()
    if not await client.collection_exists(collection):
        await client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
        )
    return client


async def upsert_collection(collection: str, vectors, wait: bool = True):
    client = await get_qdrant_client()
    await client.upsert(
        collection_name=collection,
        wait=wait,
        points=vectors,
    )


async def scroll_collection(
    collection: str,
    scroll_filter: Filter | None = None,
    limit: int = 500,
):
    all_points = []
    offset = None
    client = await get_qdrant_client()
    while True:
        points, next_offset = await client.scroll(
            collection_name=collection,
            scroll_filter=scroll_filter,
            with_payload=True,
            with_vectors=False,
            limit=limit,
            offset=offset,
        )
        all_points.extend(points)
        if next_offset is None:
            offset = None
            break
        offset = next_offset
    return all_points


async def query_collections(
    collection: str,
    query: list[float] = [],
    query_filter: Filter | None = None,
    top_k: int = 3,
) -> list[SearchResult]:
    client = await get_qdrant_client()
    points = await client.query_points(
        collection_name=collection,
        query=query,
        with_payload=True,
        query_filter=query_filter,
        limit=top_k,
    )
    return [
        SearchResult(
            score=p.score,
            text=p.payload.get("text", ""),
            name=p.payload.get("name", ""),
            chunk_index=p.payload.get("chunk_index", 0),
            document_id=p.payload.get("document_id", ""),
        )
        for p in points.points
        if p.payload  # guard against None payload
    ]


async def delete_collection_data(collection: str, criteria: Filter):
    client = await get_qdrant_client()
    return await client.delete(
        collection_name=collection,
        points_selector=criteria,
        wait=True,
    )
