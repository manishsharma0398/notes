from openai import AsyncOpenAI

client = AsyncOpenAI()


async def get_openai_client():
    return client
