from fastapi import APIRouter
from ..controllers.documents import embed
from ..clients.qdrant import query_collections
from qdrant_client.models import Filter, FieldCondition, MatchValue
from ..utils.models import SearchRequest, SearchResult, SearchResponse

search_router = APIRouter()


@search_router.post("")
async def search(payload: SearchRequest):
    search_vector, tokens = await embed(payload.query)
    query_filter = None
    if payload.document_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=str(payload.document_id)),
                ),
            ]
        )
    searches = query_collections(
        "docs_collection",
        query=search_vector,
        query_filter=query_filter,
        top_k=payload.top_k,
    )
    results: list[SearchResult] = []
    for search in searches:
        results.append(
            SearchResult(
                score=search.score,
                text=search.payload.get("text", ""),
                name=search.payload.get("name", ""),
                chunk_index=search.payload.get("chunk_index", -1),
                document_id=search.payload.get("document_id", ""),
            )
        )
    return SearchResponse(
        results=results,
        query_embedding_tokens=tokens,
    )
