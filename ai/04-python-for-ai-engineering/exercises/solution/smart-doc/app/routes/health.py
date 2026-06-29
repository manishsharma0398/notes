from fastapi import APIRouter, Body
from ..controllers.document_controller import database

health_router = APIRouter()


@health_router.get(
    path="",
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def get_health():
    return {
        "status": "ok",
        "documents_loaded": len(database),
    }
