from uuid import UUID, uuid4
from fastapi import APIRouter
from ..controllers.documents import chunk_document, embed_docs_batch
from ..utils.models import DocumentUploadRequest, DocumentUploadResponse
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
from ..clients.qdrant import (
    scroll_collection,
    upsert_collection,
    delete_collection_data,
)

document_router = APIRouter()


@document_router.post("", response_model=DocumentUploadResponse)
async def post_document(payload: DocumentUploadRequest):
    document_id = str(uuid4())
    chunked_doc = chunk_document(payload, document_id)
    embeddings = await embed_docs_batch(chunked_doc)

    await upsert_collection(
        collection="docs_collection",
        vectors=[
            PointStruct(
                id=str(uuid4()),
                vector=embed.embedding,
                payload={
                    "text": embed.text,
                    "token_count": embed.token_count,
                    "chunk_index": embed.chunk_index,
                    "name": embed.name,
                    "document_id": embed.document_id,
                },
            )
            for embed in embeddings.embedded_chunks
        ],
    )

    return DocumentUploadResponse(
        name=payload.name,
        document_id=document_id,
        chunk_count=len(chunked_doc),
        estimated_tokens=embeddings.tokens,
    )


@document_router.get("")
async def get_document():
    seen = set()
    docs = []
    chunks = await scroll_collection("docs_collection")
    for chunk in chunks:
        doc_id = chunk.payload.get("document_id")
        if not doc_id in seen:
            seen.add(doc_id)
            docs.append(
                {
                    "document_id": doc_id,
                    "name": chunk.payload.get("name"),
                }
            )
    return docs


@document_router.delete("/{id}")
async def delete_document(id: UUID):
    return await delete_collection_data(
        "docs_collection",
        criteria=Filter(
            must=FieldCondition(
                key="document_id",
                match=MatchValue(value=str(id)),
            ),
        ),
    )
