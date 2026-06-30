import json
from uuid import uuid4
from datetime import datetime
from ..utils.db import get_db, add_to_db

from ..utils.models import Document


def get_document_metadata(document_id: str) -> Document | None:
    db = get_db()
    return db.get(document_id)


def create_document(payload: str) -> Document:
    document_id = str(uuid4())
    created_at = datetime.now()

    document = Document(
        id=document_id,
        content=payload,
        created_at=created_at,
        word_count=len(payload.split()),
    )

    return add_to_db(document)
