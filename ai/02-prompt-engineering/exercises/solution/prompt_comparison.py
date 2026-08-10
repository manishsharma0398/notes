import os
import asyncio
from typing import Literal
import time
from dotenv import load_dotenv
from pydantic import BaseModel
import re

load_dotenv()

from openai import AsyncOpenAI

VALID_CATEGORIES = {"billing", "technical", "shipping", "account", "other"}


class Category(BaseModel):
    category: Literal["billing", "technical", "shipping", "account", "other"]


class RateLimiter:
    def __init__(self, max_calls: int, period: float, callback=None):
        self.max_calls = max_calls
        self.period = period
        self.callback = callback
        self.calls = []

    async def __aenter__(self):
        while True:
            now = time.time()
            self.calls = [t for t in self.calls if now - t < self.period]
            if len(self.calls) < self.max_calls:
                self.calls.append(now)
                break
            sleep_time = self.calls[0] + self.period - now
            if sleep_time > 0:
                if self.callback:
                    self.callback(self.calls[0] + self.period)
                await asyncio.sleep(sleep_time)

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    # base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

MODEL = "gpt-4o-mini"
MAX_CALLS = 500
PERIOD_IN_SECONDS = 60


async def model_call(system_prompt: str, message: str) -> str | None:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    )
    return response.choices[0].message.content


# ── Strategy 1: Zero-Shot ─────────────────────────────────────────────────────
ZERO_SHOT_SYSTEM = f"""
You are a customer support agent for an e-commerce portal - Rizal Mart. Your job is to classify the user message into valid categories. The categories are: {", ".join(VALID_CATEGORIES)}. You need to answer only in one word.
"""


async def classify_zero_shot(message: str) -> str | None:
    """Returns raw LLM output — no parsing."""
    return await model_call(ZERO_SHOT_SYSTEM, message)


# ── Strategy 2: Few-Shot ──────────────────────────────────────────────────────
FEW_SHOT_SYSTEM = f"""
{ZERO_SHOT_SYSTEM}

Examples:
User message - The breakdown price doesn't match the total price , category: billing
User message -  How to know if the product ship to my loaction, category: shipping 
User message -  There is a whoops page error when I navigate to the cart page, category: technical
"""


async def classify_few_shot(message: str) -> str | None:
    """Returns raw LLM output."""
    return await model_call(FEW_SHOT_SYSTEM, message)


# ── Strategy 3: Chain-of-Thought ─────────────────────────────────────────────
COT_SYSTEM = f"""
{ZERO_SHOT_SYSTEM}

Let's think step by step:
1. Identify the core user issue.
2. Match it with one of the allowed categories: {", ".join(VALID_CATEGORIES)}.
3. Output the reasoning first, then end your response with the exact prefix and name:
CATEGORY: [exact category name]
"""


async def classify_cot(message: str) -> str | None:
    """Returns full CoT response — reasoning + final answer."""
    return await model_call(COT_SYSTEM, message)


# ── Strategy 4: Structured Output ────────────────────────────────────────────
async def classify_structured(message: str) -> Category | None:
    """
    Returns a dict with 'category' key, or None if parsing failed.
    Must use response_format to enforce JSON.
    """
    response = await client.chat.completions.parse(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": ZERO_SHOT_SYSTEM,
            },
            {
                "role": "user",
                "content": message,
            },
        ],
        response_format=Category,
    )

    return response.choices[0].message.parsed


# ── Validation ────────────────────────────────────────────────────────────────
def extract_category(text: str | None) -> str | None:
    """
    Try to extract a valid category from free-text output.
    Check if any VALID_CATEGORIES word appears in the text (case-insensitive).
    Return the matched category or None if nothing valid found.
    """
    if not text:
        return None

    final_response = re.search(r"CATEGORY:\s*(\w+)", text, re.IGNORECASE)
    if final_response:
        text = final_response.group(1)
        if text is None:
            return None

    for i in VALID_CATEGORIES:
        if i.lower() in text.lower():
            return i
    return None


TEST_MESSAGES = [
    "My invoice shows $49.99 but I was told $29.99 during signup",
    "The app crashes every time I try to upload a file larger than 10MB",
    "My order hasn't arrived and it's been 3 weeks",
    "I need to reset my password but I'm not receiving the email",
    "Do you have a student discount?",  # Edge case — could be billing or other
]


# ── Runner ────────────────────────────────────────────────────────────────────
def limited(until):
    import time

    duration = max(0.0, until - time.time())
    print(f"Rate limited, sleeping for {duration:.2f} seconds...")


async def run_comparison():
    print(
        f"{'Message':<45} {'Zero-Shot':<12} {'Few-Shot':<12} {'CoT':<12} {'Structured':<12}"
    )
    print("─" * 95)

    scores = {"zero_shot": 0, "few_shot": 0, "cot": 0, "structured": 0}

    rate_limiter = RateLimiter(
        max_calls=MAX_CALLS,
        period=PERIOD_IN_SECONDS,
        callback=limited,
    )

    for msg in TEST_MESSAGES:
        async with rate_limiter:
            z = await classify_zero_shot(msg)
        async with rate_limiter:
            f = await classify_few_shot(msg)
        async with rate_limiter:
            c = await classify_cot(msg)
        async with rate_limiter:
            s = await classify_structured(msg)

        z_cat = extract_category(z) or "INVALID"
        f_cat = extract_category(f) or "INVALID"
        c_cat = extract_category(c) or "INVALID"
        s_cat = s.category if s is not None else "Invalid"

        if z_cat in VALID_CATEGORIES:
            scores["zero_shot"] += 1
        if f_cat in VALID_CATEGORIES:
            scores["few_shot"] += 1
        if c_cat in VALID_CATEGORIES:
            scores["cot"] += 1
        if s_cat in VALID_CATEGORIES:
            scores["structured"] += 1

        print(f"{msg[:44]:<45} {z_cat:<12} {f_cat:<12}  {c_cat:<12} {s_cat:<12}")

    print("\n" + "─" * 95)
    print("VALID RESPONSES (out of 5):")
    for strategy, score in scores.items():
        print(f"  {strategy:<15}: {score}/5")


if __name__ == "__main__":
    asyncio.run(run_comparison())
