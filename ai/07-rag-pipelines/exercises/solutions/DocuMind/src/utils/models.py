from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Document(BaseModel):
    source: str
    filename: str
    extension: str
    document_id: UUID = Field(default_factory=uuid4)
