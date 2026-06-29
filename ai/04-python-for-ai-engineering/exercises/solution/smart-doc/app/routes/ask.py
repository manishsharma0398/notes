import json
import asyncio
from ..utils.db import database
from fastapi import APIRouter, Depends
from ..utils.functions import get_semaphore
from ..utils.models import AskLLMRequest, AskLLMResponse, Document
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
        try:
            with open("database.json", "r", encoding="utf-8") as db:
                data = json.load(db)
                print("loaded database: ", data)
        except FileNotFoundError:
            data = {}
        except json.JSONDecodeError:
            raise ValueError("Error: The file is not a valid JSON format.")

        document = Document(**data[payload.document_id])

        llm_answer = await ask_question_to_llm(
            document=document.content,
            question=payload.question,
        )
        return llm_answer
