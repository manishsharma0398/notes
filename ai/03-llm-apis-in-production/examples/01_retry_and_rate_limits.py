"""
Chapter 3, Example 1: Rate Limits & Retry Logic

What this demonstrates:
- How to handle 429 (rate limit) and 5xx (server error) responses correctly
- Exponential backoff with jitter using tenacity
- Reading retry-after headers from provider responses
- What NOT to retry (400, 401, 404)

Run with:
    pip install openai tenacity
    export OPENAI_API_KEY=sk-...
    python retry_and_rate_limits.py
"""

import logging
import random
import time

import openai
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Part 1: Manual retry (educational — shows the mechanics) ──────────────────

def manual_retry_call(client: openai.OpenAI, messages: list) -> str:
    """
    Manual retry implementation — shows exactly what's happening.
    In production, use tenacity (Part 2) instead of this.
    """
    max_retries = 4
    attempt = 0

    while attempt <= max_retries:
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=100,
            )
            return response.choices[0].message.content

        except openai.RateLimitError as e:
            # 429: Rate limit hit
            if attempt == max_retries:
                raise

            # ALWAYS use the provider's retry-after header
            retry_after = float(e.response.headers.get("retry-after", 60))
            jitter = random.uniform(0, retry_after * 0.1)
            wait = retry_after + jitter

            logger.warning(
                f"Rate limited (attempt {attempt + 1}/{max_retries}). "
                f"Waiting {wait:.1f}s (retry-after={retry_after}s)"
            )
            time.sleep(wait)
            attempt += 1

        except openai.InternalServerError as e:
            # 500/503: Provider error, transient
            if attempt == max_retries:
                raise

            # Exponential backoff, NOT retry-after (no header for server errors)
            wait = (2 ** attempt) + random.uniform(0, 1)
            logger.warning(
                f"Server error {e.status_code} (attempt {attempt + 1}/{max_retries}). "
                f"Waiting {wait:.1f}s"
            )
            time.sleep(wait)
            attempt += 1

        except openai.BadRequestError:
            # 400: Your fault (bad schema, content policy, etc.)
            # DO NOT RETRY — it will fail identically
            raise

        except openai.AuthenticationError:
            # 401: Fix your API key
            raise

    raise RuntimeError("Exhausted retries")  # Should not reach here


# ─── Part 2: Production retry with tenacity ────────────────────────────────────

def log_retry_attempt(retry_state: RetryCallState):
    """Called before each retry sleep. Log retry context."""
    exception = retry_state.outcome.exception()
    logger.info(
        f"Retry {retry_state.attempt_number}: {type(exception).__name__}: {exception}. "
        f"Sleeping {retry_state.next_action.sleep:.1f}s"
    )


@retry(
    # Only retry on rate limits and transient server errors
    retry=retry_if_exception_type(
        (openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)
    ),
    # Exponential backoff: starts at 1s, doubles each attempt, max 60s, ±5s jitter
    wait=wait_exponential_jitter(initial=1, max=60, jitter=5),
    # Give up after 4 attempts total
    stop=stop_after_attempt(4),
    # Log each retry
    before_sleep=log_retry_attempt,
    # Re-raise the last exception after retries are exhausted
    reraise=True,
)
def tenacity_retry_call(client: openai.OpenAI, messages: list) -> str:
    """
    Production-grade retry using tenacity.
    The @retry decorator handles all retry logic — this function
    is called on every attempt, including retries.
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=100,
    )
    return response.choices[0].message.content


# ─── Part 3: Understanding what actually gets rate limited ────────────────────

def demonstrate_token_counting():
    """
    Show how TPM limits work differently from RPM limits.
    One big request can exhaust your per-minute token budget
    even if you've only made one request.
    """
    import tiktoken

    enc = tiktoken.encoding_for_model("gpt-4o")

    # Simulate two different prompt sizes
    short_prompt = "What is 2 + 2?"
    long_prompt = "Summarize this text in detail: " + ("word " * 5000)

    short_tokens = len(enc.encode(short_prompt))
    long_tokens = len(enc.encode(long_prompt))

    # GPT-4o Tier 1 limits (example)
    rpm_limit = 500
    tpm_limit = 30_000

    print("\n=== TPM vs RPM Rate Limiting ===")
    print(f"Tier 1 limits: {rpm_limit} RPM, {tpm_limit} TPM")
    print()
    print(f"Short prompt tokens:  {short_tokens}")
    print(f"Long prompt tokens:   {long_tokens}")
    print()
    print(f"With short prompts:")
    print(f"  Requests until RPM limit: {rpm_limit}")
    print(f"  Requests until TPM limit: {tpm_limit // short_tokens}")
    print()
    print(f"With long prompts:")
    print(f"  Requests until RPM limit: {rpm_limit}")
    print(f"  Requests until TPM limit: {tpm_limit // long_tokens}")
    print()
    print("KEY INSIGHT: Long prompts hit TPM limit in fewer requests.")
    print("A single 30K-token request exhausts the ENTIRE per-minute token budget.")


# ─── Main: run demonstrations ──────────────────────────────────────────────────

if __name__ == "__main__":
    import os

    # Token counting demo (no API key needed)
    demonstrate_token_counting()

    # API demo (requires API key)
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("\nSet OPENAI_API_KEY to run live API examples")
    else:
        client = openai.OpenAI(api_key=api_key)
        messages = [{"role": "user", "content": "Say 'hello world' in exactly two words."}]

        print("\n=== Tenacity Retry Demo ===")
        result = tenacity_retry_call(client, messages)
        print(f"Result: {result}")
