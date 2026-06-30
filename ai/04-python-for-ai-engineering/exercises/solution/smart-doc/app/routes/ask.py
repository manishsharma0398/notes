from ..utils.db import get_db
from ..utils.logger import logger
from fastapi import APIRouter, HTTPException
from ..utils.constants import semaphore
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
    logger.info(
        "[ask_llm] request payload info: %s",
        {
            "context": {
                "document_id": payload.document_id,
                "question": payload.question,
                "question_length": len(payload.question),
            }
        },
    )
    async with semaphore:
        db = get_db()

        doc = db.get(str(payload.document_id))

        if doc is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        llm_answer = await ask_question_to_llm(
            document=doc.content,
            question=payload.question,
        )

        return llm_answer
