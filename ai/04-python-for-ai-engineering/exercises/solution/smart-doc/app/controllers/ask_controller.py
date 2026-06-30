import time
from ..utils.logger import logger
from fastapi import HTTPException
from ..clients.openai import get_openai_client
from ..utils.models import LLMCall, AskLLMResponse


class LLMError(HTTPException):
    pass


async def ask_question_to_llm(document: str, question: str) -> AskLLMResponse:
    try:
        start = time.perf_counter()
        response = await get_openai_client().responses.parse(
            model="gpt-5.1-2025-11-13",
            # model="gpt-5.5-mini",
            text_format=LLMCall,
            input=[
                {
                    "role": "system",
                    "content": f"""You will be provided with a document and you need to answer the question regarding the document.
                    {document}
                    """,
                },
                {"role": "user", "content": question},
            ],
            max_output_tokens=200,
            temperature=0.0,
        )

        if response.output_parsed is None:
            raise LLMError(
                status_code=502,
                detail="No parsed output returned by the model.",
            )

        input_tokens = response.usage.input_tokens if response.usage else 0
        output_tokens = response.usage.output_tokens if response.usage else 0

        logger.info(
            "[ask_question_to_llm] response data: %s",
            {
                "context": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "latency_ms": time.perf_counter() - start,
                    "confidence": response.output_parsed.confidence,
                }
            },
        )

        return AskLLMResponse(
            **response.output_parsed.model_dump(),
            input_token_consumed=input_tokens,
            output_token_consumed=output_tokens,
        )
    except Exception as e:
        if isinstance(e, LLMError):
            raise

        raise HTTPException(
            status_code=502,
            detail="Error on LLM API call",
        )
