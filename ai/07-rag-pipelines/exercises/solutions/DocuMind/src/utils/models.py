from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Document(BaseModel):
    source: str
    filename: str
    extension: str
    text: str
    document_id: UUID = Field(default_factory=uuid4)


class Chunk(BaseModel):
    text: str
    token_count: int
    chunk_index: int
    doc_id: str
    src: str
    file_extension: str
    file_name: str


class EmbedChunk(Chunk):
    embedding: list[float]
