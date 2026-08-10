"""
Example 1: Prompt Technique Comparison
Demonstrates zero-shot, few-shot, and chain-of-thought on the same task.

Run: python examples/prompt_techniques_demo.py
Requires: pip install openai python-dotenv
Set OPENAI_API_KEY in your environment or .env file.
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

TASK_TEXT = "The battery lasts forever but the speaker is incredibly tinny and quiet."


def call(messages: list[dict], temperature: float = 0) -> str:
    """Single API call — returns the raw text response."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content


# ─────────────────────────────────────────────────────────────────
# ZERO-SHOT: no examples, just the task
# ─────────────────────────────────────────────────────────────────
def zero_shot(text: str) -> str:
    return call([
        {
            "role": "user",
            "content": (
                f"Classify the sentiment of this review as POSITIVE, NEGATIVE, or MIXED.\n\n"
                f"Review: \"{text}\"\n"
                f"Sentiment:"
            )
        }
    ])


# ─────────────────────────────────────────────────────────────────
# FEW-SHOT: 3 labeled examples before the actual query
# Notice: examples cover all three classes (no class imbalance)
# ─────────────────────────────────────────────────────────────────
def few_shot(text: str) -> str:
    return call([
        {
            "role": "user",
            "content": (
                "Classify sentiment as POSITIVE, NEGATIVE, or MIXED.\n\n"
                "Review: \"Absolutely love this, works perfectly out of the box.\"\n"
                "Sentiment: POSITIVE\n\n"
                "Review: \"Broke within a week. Total waste of money.\"\n"
                "Sentiment: NEGATIVE\n\n"
                "Review: \"Great camera but the battery drains in 4 hours.\"\n"
                "Sentiment: MIXED\n\n"
                f"Review: \"{text}\"\n"
                "Sentiment:"
            )
        }
    ])


# ─────────────────────────────────────────────────────────────────
# CHAIN-OF-THOUGHT: force step-by-step reasoning before the label
# Notice: "Let's think step by step" before asking for the label
# ─────────────────────────────────────────────────────────────────
def chain_of_thought(text: str) -> str:
    return call([
        {
            "role": "user",
            "content": (
                "Classify the sentiment of this product review as POSITIVE, NEGATIVE, or MIXED.\n\n"
                f"Review: \"{text}\"\n\n"
                "Let's think step by step:\n"
                "1. Identify all positive aspects mentioned.\n"
                "2. Identify all negative aspects mentioned.\n"
                "3. Weigh them to determine the overall sentiment.\n"
                "4. Final classification:"
            )
        }
    ])


# ─────────────────────────────────────────────────────────────────
# WHAT'S HAPPENING:
#
# zero_shot:
#   Model predicts most likely continuation of "Sentiment:" given the review.
#   Works because sentiment classification is a common training pattern.
#   May output "MIXED" correctly, but format is not guaranteed.
#
# few_shot:
#   Model attends to all three (review, label) pairs via attention.
#   The pattern "Review: ...\nSentiment: LABEL" is clear.
#   Model continues the pattern → very likely to output correct label + format.
#
# chain_of_thought:
#   Model generates reasoning tokens before the final label.
#   Each reasoning step is in-context when the label is predicted.
#   Better for ambiguous cases — the reasoning surfaces what was considered.
#   Cost: ~5-10x more output tokens than zero-shot.
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print(f"TASK: Classify sentiment of:\n  \"{TASK_TEXT}\"")
    print("=" * 60)

    print("\n[1] ZERO-SHOT:")
    print(f"  → {zero_shot(TASK_TEXT)}")

    print("\n[2] FEW-SHOT:")
    print(f"  → {few_shot(TASK_TEXT)}")

    print("\n[3] CHAIN-OF-THOUGHT:")
    cot_output = chain_of_thought(TASK_TEXT)
    # Format multi-line output with indentation
    for line in cot_output.strip().split("\n"):
        print(f"  {line}")

    print("\n" + "=" * 60)
    print("ENGINEERING OBSERVATIONS:")
    print("  - All three likely output MIXED for this review")
    print("  - Few-shot is more format-consistent than zero-shot")
    print("  - CoT is verbose but shows its reasoning (useful for debugging)")
    print("  - For a classification pipeline, use few-shot + structured output")
