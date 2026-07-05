from uuid import UUID
from pydantic import BaseModel, Field
from .constants import Severity


class PostReview(BaseModel):
    code: str
    language: str


class BatchReview(BaseModel):
    snippets: list[PostReview]


class CodeIssue(BaseModel):
    severity: Severity
    category: str
    description: str
    fix_suggestion: str
    line_hint: str | None


class CodeReview(BaseModel):
    review_id: UUID
    language: str
    overall_score: int = Field(
        gt=1,
        lt=10,
        description="Overall score from 1 to 10, where 10 is excellent",
    )
    bugs: list[CodeIssue]
    best_practices: list[CodeIssue]
    security: list[CodeIssue]
    summary: str
    success: bool
    error: str | None
    processing_time_ms: float
