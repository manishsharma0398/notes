import time
from fastapi import APIRouter
from ..clients.openai import llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

health_router = APIRouter()


@health_router.get(path="")
async def get_healthz():
    health_check_chain = (
        ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "This is a lightweight LLM call to check the connection and latency",
                ),
                ("human", "{question}"),
            ]
        )
        | llm
        | StrOutputParser()
    )
    start = time.perf_counter()
    try:
        await health_check_chain.ainvoke({"question": "Hi, How are you ?"})
        return {
            "status": "ok",
            "model": "gpt-4o-mini",
            "latency_ms": (time.perf_counter() - start) * 1000,
        }
    except Exception as e:
        return {
            "status": "error",
            "model": "gpt-4o-mini",
            "latency_ms": (time.perf_counter() - start) * 1000,
            "error": f"{e}",
        }
