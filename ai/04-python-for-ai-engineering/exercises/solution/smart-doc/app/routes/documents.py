from uuid import UUID
from fastapi import APIRouter, Body, HTTPException
from ..utils.models import Document, DocumentMetadata
from ..controllers.document_controller import create_document, get_document_metadata

document_router = APIRouter()


@document_router.post(
    path="",
    response_model=Document,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def doc(payload: str = Body(media_type="text/plain")):
    return create_document(payload)


@document_router.get(
    path="/{document_id}",
    response_model=DocumentMetadata,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def get_metadata(document_id: UUID):
    document_metadata = get_document_metadata(str(document_id))
    if document_metadata is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )
    return DocumentMetadata(
        id=document_metadata.id,
        created_at=document_metadata.created_at,
        word_count=document_metadata.word_count,
    )
