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


class ClassifyTicket(BaseModel):
    urgency_level: UrgencyLevel
    classification_reason: str
    confidence_score: float = Field(ge=0.0, le=1.0)


class TicketExecutionResult(ClassifyTicket):
    time_taken_ms: int


class TicketClassification(TicketExecutionResult):
    prompt: str
    success: bool
    error: str | None = None


class TicketClassificationResponse(BaseModel):
    result: list[TicketClassification]
    processed_tickets_count: int
    success_tickets_count: int
    failed_tickets_count: int
    time_taken_in_ms: int
    total_individual_time: int


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI()


async def classify_ticket(
    user_message: str, client: AsyncOpenAI
) -> TicketExecutionResult:
    async with semaphore:
        start_time = time.perf_counter()
        response = await client.responses.parse(
            model="gpt-5.1-2025-11-13",
            text_format=ClassifyTicket,
            input=[
                {
                    "role": "system",
                    "content": "You are a support assistant. You need to answer user queries.",
                },
                {"role": "user", "content": user_message},
            ],
        )
        time_taken = int((time.perf_counter() - start_time) * 1000)
        if response.output_parsed is None:
            raise ValueError("No parsed output returned by the model.")
        return TicketExecutionResult(
            **response.output_parsed.model_dump(),
            time_taken_ms=time_taken,
        )


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
        if isinstance(result, TicketExecutionResult):

            res.append(
                TicketClassification(
                    **result.model_dump(),
                    prompt=query,
                    success=True,
                )
            )
        else:
            res.append(
                TicketClassification(
                    prompt=query,
                    error=f"{type(result).__name__}: {result}",
                    success=False,
                    classification_reason="",
                    confidence_score=0.0,
                    urgency_level=UrgencyLevel.LOW,
                    time_taken_ms=0,
                )
            )
            failed_tickets_count += 1

    processed_tickets_count = len(payload.user_query)
    success_tickets_count = processed_tickets_count - failed_tickets_count

    total_individual_time = sum(
        r.time_taken_ms for r in response if isinstance(r, TicketExecutionResult)
    )

    return TicketClassificationResponse(
        result=res,
        failed_tickets_count=failed_tickets_count,
        processed_tickets_count=processed_tickets_count,
        success_tickets_count=success_tickets_count,
        time_taken_in_ms=time_taken,
        total_individual_time=total_individual_time,
    )
