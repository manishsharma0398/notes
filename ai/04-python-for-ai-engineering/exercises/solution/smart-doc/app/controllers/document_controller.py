from uuid import UUID, uuid4
from datetime import datetime

from ..utils.models import Document

database: dict[UUID, Document] = {}


def get_document_metadata(document_id: int):
    pass


def create_document(payload: str) -> Document:
    document_id = uuid4()
    created_at = datetime.now()

    document = Document(
        id=document_id,
        content=payload,
        created_at=created_at,
        word_count=len(payload.split()),
    )

    database[document_id] = document

    return document
