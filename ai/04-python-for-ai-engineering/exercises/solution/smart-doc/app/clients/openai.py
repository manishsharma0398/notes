from functools import lru_cache
from openai import AsyncOpenAI


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI()


async def close_openai_client() -> None:
    await get_openai_client().close()
