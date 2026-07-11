from uuid import uuid4
from fastapi import APIRouter
from ..controllers.documents import chunk_document, embed_docs_batch
from ..utils.models import DocumentUploadRequest, DocumentUploadResponse

document_router = APIRouter()


@document_router.post("", response_model=DocumentUploadResponse)
async def post_document(payload: DocumentUploadRequest):
    chunked_doc = chunk_document(payload.text)
    embeddings = await embed_docs_batch(chunked_doc)
    return DocumentUploadResponse(
        document_id=str(uuid4()),
        name=payload.name,
        chunk_count=len(chunked_doc),
        estimated_tokens=embeddings.tokens,
    )


@document_router.get("")
def get_document():
    pass


@document_router.delete("/{id}")
def delete_document():
    pass
