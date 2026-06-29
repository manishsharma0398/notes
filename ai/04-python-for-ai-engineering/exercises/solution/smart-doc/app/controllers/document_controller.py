import json
from uuid import UUID, uuid4
from datetime import datetime

from ..utils.models import Document

database: dict[UUID, Document] = {}


def get_document_metadata(document_id: int):
    pass


def create_document(payload: str) -> Document:
    document_id = str(uuid4())
    created_at = datetime.now()

    document = Document(
        id=document_id,
        content=payload,
        created_at=created_at,
        word_count=len(payload.split()),
    )

    try:
        with open("database.json", "r", encoding="utf-8") as db:
            data = json.load(db)
            print("loaded database: ", data)
    except FileNotFoundError:
        data = {}
    except json.JSONDecodeError:
        raise ValueError("Error: The file is not a valid JSON format.")

    data[document_id] = document.model_dump(mode="json")

    with open("database.json", "w", encoding="utf-8") as db:
        json.dump(data, db)

    return document
