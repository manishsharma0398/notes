import asyncio
from .constants import MAX_CONCURRENT_REQUESTS


def get_semaphore():
    asyncio.Semaphore(value=MAX_CONCURRENT_REQUESTS)
