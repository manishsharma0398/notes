from ..utils.models import LLMCall
from ..clients.openai import get_openai_client


async def ask_question_to_llm(document: str, question: str) -> LLMCall:
    response = await get_openai_client().responses.parse(
        model="gpt-5.1-2025-11-13",
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
    )
    if response.output_parsed is None:
        raise ValueError("No parsed output returned by the model.")
    return response.output_parsed
