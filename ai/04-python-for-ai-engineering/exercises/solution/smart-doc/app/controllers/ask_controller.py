from uuid import UUID
from ..utils.models import AskLLMResponse
from ..clients.openai import get_openai_client


from ..utils.models import Document

database: dict[UUID, Document] = {}


async def ask_question_to_llm(question: str) -> AskLLMResponse:
    response = await get_openai_client().responses.parse(
        model="gpt-5.1-mini",
        text_format=AskLLMResponse,
        input=[
            {
                "role": "system",
                "content": "You are a support assistant. You need to answer user queries.",
            },
            {"role": "user", "content": question},
        ],
    )
    if response.output_parsed is None:
        raise ValueError("No parsed output returned by the model.")
    return response.output_parsed
