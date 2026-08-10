import time
from ..utils.db import get_db
from ..utils.logger import logger
from ..utils.constants import semaphore
from fastapi import APIRouter, HTTPException
from ..utils.models import AskRequest, AskLLMResponse
from ..controllers.ask_controller import ask_question_to_llm

ask_router = APIRouter()


@ask_router.post(
    path="",
    response_model=AskLLMResponse,
    response_model_exclude_none=True,
    response_model_exclude_unset=True,
)
async def ask_llm(
    payload: AskRequest,
):
    async with semaphore:
        db = get_db()

        doc = db.get(str(payload.document_id))

        if doc is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        start = time.perf_counter()
        llm_answer = await ask_question_to_llm(
            document=doc.content,
            question=payload.question,
        )

        logger.info(
            "[ask_question_to_llm] response data",
            extra={
                "question": payload.question,
                "document_id": payload.document_id,
                "confidence": llm_answer.confidence,
                "question_length": len(payload.question),
                "latency_ms": time.perf_counter() - start,
                "input_tokens": llm_answer.input_token_consumed,
                "output_tokens": llm_answer.output_token_consumed,
            },
        )

        return llm_answer
