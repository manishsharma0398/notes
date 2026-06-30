from fastapi import APIRouter
from ..utils.db import get_db

health_router = APIRouter()


@health_router.get(
    path="",
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def get_health():
    return {
        "status": "ok",
        "documents_loaded": len(get_db()),
    }
