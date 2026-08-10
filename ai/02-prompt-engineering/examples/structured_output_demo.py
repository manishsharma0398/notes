"""
Example 2: Structured Outputs
Demonstrates the three levels of JSON enforcement and why you should use the best one.

Run: python examples/structured_output_demo.py
Requires: pip install openai pydantic python-dotenv
Set OPENAI_API_KEY in your environment or .env file.
"""

import os
import json
from typing import Literal
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

REVIEW = "The battery lasts forever but the speaker is incredibly tinny and quiet."


# ─────────────────────────────────────────────────────────────────
# APPROACH 1: Prompt-only JSON instruction (fragile — don't use in prod)
# ─────────────────────────────────────────────────────────────────
def approach_1_prompt_only(text: str) -> str:
    """
    No structural enforcement. Model is asked via prose to return JSON.
    Failure modes:
      - Adds markdown ```json fences
      - Adds explanation before/after
      - Uses different key names
      - Returns invalid JSON if content has quotes
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a sentiment analysis API. "
                    "Respond ONLY with a JSON object with these exact keys: "
                    "sentiment (POSITIVE/NEGATIVE/MIXED), confidence (0.0-1.0), key_issues (list of strings). "
                    "Do not include any other text."
                )
            },
            {"role": "user", "content": f"Analyze: \"{text}\""}
        ],
        temperature=0,
    )
    return response.choices[0].message.content  # Raw string — may not be valid JSON


# ─────────────────────────────────────────────────────────────────
# APPROACH 2: JSON mode (guarantees valid JSON, not specific schema)
# ─────────────────────────────────────────────────────────────────
def approach_2_json_mode(text: str) -> dict:
    """
    response_format={"type": "json_object"} enables constrained decoding.
    Guarantees: output is always valid JSON.
    Does NOT guarantee: specific keys, specific types, no extra fields.

    What happens under the hood:
      The token sampler is filtered at each step to only allow tokens
      that produce valid JSON given what has already been generated.
      If the model has output {"sentiment": " the next token must be
      a valid string character — it cannot output a token that breaks JSON.
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a sentiment analysis API. "
                    "Return JSON with: sentiment (POSITIVE/NEGATIVE/MIXED), "
                    "confidence (float 0-1), key_issues (array of strings)."
                )
            },
            {"role": "user", "content": f"Analyze: \"{text}\""}
        ],
        response_format={"type": "json_object"},  # ← CONSTRAINED DECODING
        temperature=0,
    )
    return json.loads(response.choices[0].message.content)


# ─────────────────────────────────────────────────────────────────
# APPROACH 3: Pydantic schema (guarantees exact schema — use this in production)
# ─────────────────────────────────────────────────────────────────
class SentimentResult(BaseModel):
    """This Pydantic model defines the exact contract for the LLM's output."""
    sentiment: Literal["POSITIVE", "NEGATIVE", "MIXED"]
    confidence: float
    key_issues: list[str]
    reasoning: str  # Let model explain — useful for debugging in production


def approach_3_pydantic_schema(text: str) -> SentimentResult:
    """
    client.beta.chat.completions.parse() converts the Pydantic model to JSON Schema.
    The inference engine uses it for constrained decoding.

    What happens:
      1. Pydantic model → JSON Schema (done by the SDK)
      2. JSON Schema sent to API alongside messages
      3. Inference engine uses schema for constrained token sampling
      4. Response is guaranteed to match SentimentResult exactly
      5. SDK auto-parses the JSON → SentimentResult instance

    Result: response.choices[0].message.parsed is a SentimentResult object.
    Type-safe. No parsing code. No try/except around json.loads().
    """
    response = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Analyze the sentiment of the given product review."
            },
            {"role": "user", "content": f"Analyze: \"{text}\""}
        ],
        response_format=SentimentResult,  # ← Pydantic model as schema
        temperature=0,
    )
    return response.choices[0].message.parsed


# ─────────────────────────────────────────────────────────────────
# PRODUCTION COMPARISON
# ─────────────────────────────────────────────────────────────────
# Approach | JSON Valid? | Schema Correct? | Type-safe? | Prod-ready?
# ---------|-------------|-----------------|------------|------------
# 1 (prose)|   ~80%      |      ~60%       |    No      |    No
# 2 (mode) |   100%      |      ~85%       |    No      |  Partial
# 3 (schema)|  100%      |      100%       |    Yes     |   Yes
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print(f"INPUT: \"{REVIEW}\"")
    print("=" * 60)

    print("\n[APPROACH 1] Prompt-only (fragile):")
    raw = approach_1_prompt_only(REVIEW)
    print(f"  Raw output: {raw}")
    try:
        parsed = json.loads(raw)
        print(f"  Parsed OK: {parsed}")
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON parse FAILED: {e}")
        print("  This is the failure mode this approach is prone to.")

    print("\n[APPROACH 2] JSON mode (valid JSON, schema not enforced):")
    result2 = approach_2_json_mode(REVIEW)
    print(f"  Result: {json.dumps(result2, indent=2)}")
    print("  ✅ Always valid JSON. But key names and types may vary.")

    print("\n[APPROACH 3] Pydantic schema (production-ready):")
    result3 = approach_3_pydantic_schema(REVIEW)
    print(f"  sentiment:   {result3.sentiment}")
    print(f"  confidence:  {result3.confidence:.2f}")
    print(f"  key_issues:  {result3.key_issues}")
    print(f"  reasoning:   {result3.reasoning}")
    print("  ✅ Type-safe. Schema-guaranteed. No parsing code needed.")
    print()
    print("ENGINEERING NOTE:")
    print("  In production, approach 3 eliminates an entire class of bugs:")
    print("  - No json.loads() that might throw")
    print("  - No checking if keys exist")
    print("  - No handling of unexpected types")
    print("  - result3.sentiment is always one of POSITIVE/NEGATIVE/MIXED")
    print("  IDE autocomplete works on result3.*")
