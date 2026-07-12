from uuid import uuid4
from fastapi import APIRouter
from qdrant_client.models import PointStruct
from ..controllers.documents import chunk_document, embed_docs_batch
from ..utils.models import DocumentUploadRequest, DocumentUploadResponse
from ..clients.qdrant import scroll_collection, upsert_collection, create_collection

document_router = APIRouter()


@document_router.post("", response_model=DocumentUploadResponse)
async def post_document(payload: DocumentUploadRequest):
    document_id = str(uuid4())
    chunked_doc = chunk_document(payload, document_id)
    embeddings = await embed_docs_batch(chunked_doc)
    create_collection("docs_collection", 1536)
    upsert_collection(
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
def get_document():
    seen = set()
    docs = []
    chunks = scroll_collection("docs_collection")
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
def delete_document():
    pass
