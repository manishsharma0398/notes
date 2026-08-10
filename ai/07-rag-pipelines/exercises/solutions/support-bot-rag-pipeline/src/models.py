from pydantic import BaseModel


class IngestedDoc(BaseModel):
    source: str
    text: str


class Chunk(BaseModel):
    text: str
    token_count: int
    chunk_index: int
    src: str
    document_id: str


class EmbeddedChunk(Chunk):
    embedding: list[float]


class EmbedDocsBatch(BaseModel):
    tokens: int
    embedded_chunks: list[EmbeddedChunk]
