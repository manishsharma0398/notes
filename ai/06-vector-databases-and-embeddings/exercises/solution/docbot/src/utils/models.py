from pydantic import BaseModel


class DocumentUploadRequest(BaseModel):
    name: str
    text: str


class DocumentUploadResponse(BaseModel):
    name: str
    document_id: str
    chunk_count: int
    estimated_tokens: int


class EmbedDocsBatch(BaseModel):
    tokens: int
    embeddings: list[float]
