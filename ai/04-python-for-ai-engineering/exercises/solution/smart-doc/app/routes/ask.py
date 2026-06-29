import asyncio
from fastapi import APIRouter, Depends
from ..utils.functions import get_semaphore
from ..utils.models import AskLLMRequest, AskLLMResponse
from ..controllers.ask_controller import ask_question_to_llm

ask_router = APIRouter()


@ask_router.post(
    path="",
    response_model=AskLLMResponse,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
async def ask_llm(
    payload: AskLLMRequest,
    semaphore: asyncio.Semaphore = Depends(get_semaphore),
):
    async with semaphore:
        await ask_question_to_llm(question=payload.question)
