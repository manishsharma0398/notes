from fastapi import APIRouter, Body
from ..utils.models import Document
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
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def get_metadata(document_id: int):
    return get_document_metadata(document_id)
