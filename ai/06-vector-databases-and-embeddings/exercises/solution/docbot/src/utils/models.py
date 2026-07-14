from uuid import UUID
from pydantic import BaseModel


class DocumentUploadRequest(BaseModel):
    name: str
    text: str


class DocumentUploadResponse(BaseModel):
    name: str
    document_id: str
    chunk_count: int
    estimated_tokens: int


class Chunk(BaseModel):
    text: str
    token_count: int
    chunk_index: int
    name: str
    document_id: str


class EmbeddedChunk(Chunk):
    embedding: list[float]


class EmbedDocsBatch(BaseModel):
    tokens: int
    embedded_chunks: list[EmbeddedChunk]


class SearchRequest(BaseModel):
    query: str
    top_k: int = 3
    document_id: UUID | None = None


class SearchResult(BaseModel):
    score: float | None
    text: str
    name: str
    chunk_index: int
    document_id: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query_embedding_tokens: int


class AskRequest(BaseModel):
    question: str
    document_id: UUID | None = None
    top_k: int = 4


class LLMResponse(BaseModel):
    answer: str


class AskResponse(LLMResponse):
    sources: list[str]  # list of source document names used
    chunks_used: int
    question: str
