import asyncio
from .constants import MAX_CONCURRENT_REQUESTS


def get_semaphore():
    return asyncio.Semaphore(value=MAX_CONCURRENT_REQUESTS)
