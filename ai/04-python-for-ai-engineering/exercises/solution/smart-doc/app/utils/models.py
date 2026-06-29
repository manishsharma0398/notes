from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from .constants import ConfidenceLevel


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


class LLMCall(BaseModel):
    answer: str
    found_in_document: bool
    answer_support: str | None
    confidence: ConfidenceLevel


class AskLLMResponse(LLMCall):
    token_usage: int = Field(
        description="Total input and output token used",
    )


class AskLLMRequest(BaseModel):
    document_id: int
    question: str
