from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from .constants import ConfidenceLevel


class DocumentMetadata(BaseModel):
    id: str
    word_count: int
    created_at: datetime


class Document(DocumentMetadata):
    content: str


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
    input_token_consumed: int = Field(
        description="Total input token used",
    )
    output_token_consumed: int = Field(
        description="Total output token used",
    )


Database = dict[str, Document]
