from uuid import UUID
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter


def get_qdrant_client():
    # return QdrantClient(location=":memory:")
    return QdrantClient(url="http://localhost:6333")


def create_collection(collection: str, vector_size: int):
    client = get_qdrant_client()
    if not client.collection_exists(collection):
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
    return client


def upsert_collection(collection: str, vectors, wait: bool = True):
    get_qdrant_client().upsert(
        collection_name=collection,
        wait=wait,
        points=vectors,
    )


def scroll_collection(
    collection: str,
    scroll_filter: Filter = Filter(),
    limit: int = 500,
):
    all_points = []
    offset = None
    while True:
        points, next_offset = get_qdrant_client().scroll(
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


def query_collections(
    collection: str,
    query: list[float] = [],
    query_filter: Filter | None = Filter(),
    top_k: int = 3,
):
    return (
        get_qdrant_client()
        .query_points(
            collection_name=collection,
            query=query,
            with_payload=True,
            query_filter=query_filter,
            limit=top_k,
        )
        .points
    )
