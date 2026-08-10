"""
Chapter 1 — Example 1: The Autoregressive Loop
================================================
This example simulates what an LLM actually does under the hood —
generating one token at a time and feeding it back.

We use the OpenAI API with max_tokens=1 to observe each step.

Run: python autoregressive_demo.py
Requires: pip install openai
Set: OPENAI_API_KEY environment variable
"""

import os
import time
# pyrefly: ignore [missing-import]
from openai import OpenAI, RateLimitError
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"),     base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

def generate_one_token(messages: list[dict], retries: int = 3) -> str:
    """
    One forward pass of the transformer.
    Returns exactly one predicted token.
    Retries on rate limit (429) with exponential backoff.
    """
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model="gemini-2.5-flash-lite",
                messages=messages,
                max_tokens=1,
                temperature=0,  # deterministic for demo
            )
            # Gemini via OpenAI-compat endpoint can return None content
            # (e.g. on safety filters or empty predictions) — guard against it
            content = response.choices[0].message.content
            return content if content is not None else ""
        except RateLimitError as e:
            wait = 20 * (attempt + 1)  # 20s, 40s, 60s
            print(f"  [Rate limited] Waiting {wait}s before retry {attempt + 1}/{retries}...")
            time.sleep(wait)
    raise RuntimeError(
        "\n\nQuota exhausted on all retries.\n"
        "Your free-tier daily limit is used up.\n"
        "Options:\n"
        "  1. Wait ~24h for quota reset\n"
        "  2. Enable billing at https://console.cloud.google.com/billing\n"
        "  3. Use a different Google Cloud project with a fresh API key"
    )

def autoregressive_generate(prompt: str, max_steps: int = 15) -> str:
    """
    Manually simulate the autoregressive generation loop.
    Each iteration = one transformer forward pass = one token.
    """
    messages = [{"role": "user", "content": prompt}]
    generated_tokens = []

    print(f"Prompt: {prompt!r}")
    print(f"{'Step':<6} {'Generated Token':<20} {'Running Output'}")
    print("-" * 60)

    for step in range(max_steps):
        token = generate_one_token(messages)

        # Skip empty tokens (can happen at boundaries) but count the step
        if not token:
            break

        generated_tokens.append(token)
        running_output = "".join(generated_tokens)

        print(f"{step + 1:<6} {token!r:<20} {running_output!r}")

        # Feed the generated token back as assistant message
        # (In reality, it's appended to the context and re-processed)
        messages.append({"role": "assistant", "content": token})
        messages.append({"role": "user", "content": "continue"})  # signal to keep going

        # Stop if we hit a natural stopping point
        if token in [".", "!", "?", "\n"] and step > 2:
            break

    return "".join(generated_tokens)


if __name__ == "__main__":
    # Key insight: watch how each token depends on ALL previous tokens
    result = autoregressive_generate("Hey there, how are you?")
    print(f"\nFinal output: {result!r}")

    print("\n" + "=" * 60)
    print("KEY OBSERVATIONS:")
    print("1. The model generates ONE token per API call")
    print("2. Each token is influenced by ALL prior context")
    print("3. This is why streaming feels 'word by word'")
    print("4. In production: the server does this loop, streams tokens to you")
