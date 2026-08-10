from fastapi import APIRouter
from ..controllers.documents import embed
from ..clients.qdrant import query_collections
from ..utils.models import SearchRequest, SearchResponse
from qdrant_client.models import Filter, FieldCondition, MatchValue

search_router = APIRouter()


@search_router.post("", response_model=SearchResponse)
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
    searches = await query_collections(
        "docs_collection",
        query=search_vector,
        query_filter=query_filter,
        top_k=payload.top_k,
    )
    return SearchResponse(
        results=searches,
        query_embedding_tokens=tokens,
    )
