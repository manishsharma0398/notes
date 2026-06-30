import asyncio
from enum import Enum

MAX_CONCURRENT_REQUESTS = 5


class ConfidenceLevel(str, Enum):
    LOW = "low"
    HIGH = "high"
    MEDIUM = "medium"


semaphore = asyncio.Semaphore(value=MAX_CONCURRENT_REQUESTS)
