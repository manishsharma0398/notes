from fastapi import FastAPI, Body
from pydantic import BaseModel, Field
from typing import List
import time
from enum import Enum
from openai import AsyncOpenAI
from dotenv import load_dotenv
import asyncio

load_dotenv()

app = FastAPI()
client = AsyncOpenAI()


class ClassifyPrompt(BaseModel):
    user_query: List[str] = Field(min_length=1, max_length=20)


class UrgencyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketClassification(BaseModel):
    prompt: str
    urgency_level: UrgencyLevel
    classification_reason: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    success: bool
    error: str | None = None


class TicketClassificationResponse(BaseModel):
    result: list[TicketClassification]
    processed_tickets_count: int
    success_tickets_count: int
    failed_tickets_count: int
    time_taken_in_ms: int


async def classify_ticket(semaphore: asyncio.Semaphore, user_message):
    async with semaphore:
        response = await client.responses.parse(
            model="gpt-5.1-2025-11-13",
            text_format=TicketClassification,
            input=[
                {
                    "role": "system",
                    "content": "You are a support assistant. You need to answer user queries.",
                },
                {"role": "user", "content": user_message},
            ],
        )
        return response.output_parsed


@app.post(
    path="/classify",
    response_model=TicketClassificationResponse,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
async def classify_route(
    payload: ClassifyPrompt = Body(),
):
    start_time = time.perf_counter()
    semaphore = asyncio.Semaphore(5)
    tasks = [classify_ticket(semaphore, query) for query in payload.user_query]
    response = await asyncio.gather(*tasks)
    time_taken = int((time.perf_counter() - start_time) * 1000)
    return TicketClassificationResponse(
        result=response,
        failed_tickets_count=0,
        processed_tickets_count=1,
        success_tickets_count=1,
        time_taken_in_ms=time_taken,
    )
