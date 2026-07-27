from openai import AsyncOpenAI

_client = None


async def get_openai_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI()
    return _client
