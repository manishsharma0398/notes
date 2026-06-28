from fastapi import FastAPI, Body
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID, uuid4


class Payload(BaseModel):
    payload: str


class Document(BaseModel):
    id: UUID
    content: str
    word_count: int
    created_at: datetime


class AskRequest(BaseModel):
    document_id: UUID
    question: str = Field(
        min_length=10,
        max_length=500,
    )


app = FastAPI()

database: dict[UUID, Document] = {}


@app.post(
    path="/documents",
    response_model=Document,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
def doc(payload: str = Body(media_type="text/plain")):
    document_id = uuid4()
    created_at = datetime.now()

    document = Document(
        id=document_id,
        created_at=created_at,
        content=payload,
        word_count=len(payload.split()),
    )

    database[document_id] = document

    return document


@app.get(path="/documents/{document_id}")
def get_metadata():
    pass


@app.get(path="/health")
def get_health():
    return {"status": "ok", "documents_loaded": 0}
