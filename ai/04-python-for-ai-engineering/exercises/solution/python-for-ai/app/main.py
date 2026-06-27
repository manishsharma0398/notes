from fastapi import FastAPI, Body, Depends
from pydantic import BaseModel, Field
import time
from enum import Enum
from openai import AsyncOpenAI
from dotenv import load_dotenv
import asyncio
from functools import lru_cache

load_dotenv()

MAX_CONCURRENT_REQUESTS = 5
app = FastAPI()
semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)


class ClassifyPrompt(BaseModel):
    user_query: list[str] = Field(min_length=1, max_length=20)


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


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI()


async def classify_ticket(
    user_message: str, client: AsyncOpenAI
) -> TicketClassification:
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
        if response.output_parsed is None:
            raise ValueError("No parsed output returned by the model.")
        return response.output_parsed


@app.post(
    path="/classify",
    response_model=TicketClassificationResponse,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
async def classify_route(
    payload: ClassifyPrompt = Body(),
    client: AsyncOpenAI = Depends(get_openai_client),
):
    start_time = time.perf_counter()
    tasks = [classify_ticket(query, client) for query in payload.user_query]
    response = await asyncio.gather(*tasks, return_exceptions=True)
    time_taken = int((time.perf_counter() - start_time) * 1000)

    failed_tickets_count = 0

    res: list[TicketClassification] = []

    for query, result in zip(payload.user_query, response):
        if isinstance(result, TicketClassification):
            res.append(result)
        else:
            res.append(
                TicketClassification(
                    prompt=query,
                    error=f"{type(result).__name__}: {result}",
                    success=False,
                    classification_reason="",
                    confidence_score=0.0,
                    urgency_level=UrgencyLevel.LOW,
                )
            )
            failed_tickets_count += 1

    processed_tickets_count = len(payload.user_query)
    success_tickets_count = processed_tickets_count - failed_tickets_count

    return TicketClassificationResponse(
        result=res,
        failed_tickets_count=failed_tickets_count,
        processed_tickets_count=processed_tickets_count,
        success_tickets_count=success_tickets_count,
        time_taken_in_ms=time_taken,
    )
