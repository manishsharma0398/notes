"""
Example 1: Pydantic for LLM Output Parsing

Demonstrates three patterns:
  1. Manual JSON parsing with Pydantic validation
  2. OpenAI Structured Outputs (model-enforced schema)
  3. Robust error handling for production

Run:
  pip install openai pydantic
  export OPENAI_API_KEY=your_key
  python 01_pydantic_output_parsing.py
"""

import asyncio
import json
import re
from typing import Optional

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator

client = AsyncOpenAI()


# ─── Schema Definitions ──────────────────────────────────────────────────────


class ExtractedEntity(BaseModel):
    name: str
    entity_type: str  # person, organization, location, product
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence 0-1")
    context: Optional[str] = None

    @field_validator("entity_type")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        allowed = {"person", "organization", "location", "product"}
        if v.lower() not in allowed:
            raise ValueError(f"entity_type must be one of {allowed}, got '{v}'")
        return v.lower()


class ExtractionResult(BaseModel):
    entities: list[ExtractedEntity]
    total_found: int

    @field_validator("total_found")
    @classmethod
    def validate_count(cls, v: int, info) -> int:
        # Cross-field validation: total_found must match actual entities count
        # Note: in Pydantic v2, access other fields via info.data
        if "entities" in info.data and v != len(info.data["entities"]):
            raise ValueError(
                f"total_found ({v}) doesn't match entities count ({len(info.data['entities'])})"
            )
        return v


# ─── Parsing Utilities ────────────────────────────────────────────────────────


def strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers from LLM output."""
    pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    match = re.search(pattern, text)
    return match.group(1).strip() if match else text.strip()


def parse_llm_json(raw_text: str, model_class: type[BaseModel]) -> BaseModel:
    """
    Full parsing pipeline:
      raw string → strip fences → json.loads → Pydantic validation

    Raises:
      json.JSONDecodeError: LLM didn't produce valid JSON at all
      ValidationError: JSON was valid but schema mismatch
    """
    cleaned = strip_markdown_fences(raw_text)
    data = json.loads(cleaned)
    return model_class(**data)


# ─── Approach 1: Prompt Engineering + Pydantic ────────────────────────────────


EXTRACTION_PROMPT = """Extract all named entities from the text below.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "entities": [
    {"name": "...", "entity_type": "person|organization|location|product", "confidence": 0.95, "context": "..."}
  ],
  "total_found": <count>
}"""


async def extract_entities_manual(text: str) -> ExtractionResult | None:
    """Approach 1: Instruct model to produce JSON, parse manually."""
    print("\n[Approach 1] Prompt engineering + manual Pydantic parsing")

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": EXTRACTION_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.0,
        max_tokens=1024,
    )

    raw_output = response.choices[0].message.content
    print(f"  Raw LLM output: {raw_output[:200]}...")

    try:
        result = parse_llm_json(raw_output, ExtractionResult)
        print(f"  ✅ Parsed {result.total_found} entities")
        return result
    except json.JSONDecodeError as e:
        # Model produced non-JSON output — prompt engineering failure
        print(f"  ❌ JSON parse failed: {e}")
        print(f"     Root cause: model didn't follow JSON instruction")
        return None
    except ValidationError as e:
        # JSON was valid but didn't match our schema — schema mismatch
        print(f"  ❌ Schema validation failed:")
        for error in e.errors():
            print(f"     Field '{'.'.join(str(l) for l in error['loc'])}': {error['msg']}")
        return None


# ─── Approach 2: OpenAI Structured Outputs ────────────────────────────────────


# Separate model for structured outputs (no custom validators that conflict with schema)
class EntitySO(BaseModel):
    name: str
    entity_type: str
    confidence: float


class ExtractionResultSO(BaseModel):
    entities: list[EntitySO]
    total_found: int


async def extract_entities_structured(text: str) -> ExtractionResultSO | None:
    """Approach 2: OpenAI Structured Outputs — model-enforced schema via constrained decoding."""
    print("\n[Approach 2] OpenAI Structured Outputs")

    try:
        response = await client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",  # Minimum version required for structured outputs
            messages=[
                {
                    "role": "system",
                    "content": "Extract all named entities (persons, organizations, locations, products) from the text.",
                },
                {"role": "user", "content": text},
            ],
            response_format=ExtractionResultSO,
            max_tokens=1024,
        )

        result = response.choices[0].message.parsed
        print(f"  ✅ Extracted {result.total_found} entities (no parsing code needed)")
        return result

    except Exception as e:
        print(f"  ❌ Structured output failed: {e}")
        return None


# ─── Approach 3: Demonstrating ValidationError information ─────────────────────


def demonstrate_validation_errors():
    """Show what ValidationError actually gives you — not just a crash."""
    print("\n[Demo] What ValidationError tells you")

    bad_data = {
        "entities": [
            {"name": "Apple Inc", "entity_type": "COMPANY", "confidence": 1.5},  # invalid type and confidence
            {"name": "Elon Musk"},  # missing required entity_type
        ],
        "total_found": 99,  # doesn't match
    }

    try:
        ExtractionResult(**bad_data)
    except ValidationError as e:
        print(f"  {len(e.errors())} validation errors found:")
        for err in e.errors():
            loc = " → ".join(str(l) for l in err["loc"])
            print(f"    [{loc}] {err['msg']} (type: {err['type']})")

    # Key point: you know EXACTLY which fields failed and why.
    # This is what you log in production to debug LLM output problems.


# ─── Settings Pattern ─────────────────────────────────────────────────────────


def demonstrate_settings():
    """
    Show BaseSettings pattern.
    Requires: pip install pydantic-settings
    """
    print("\n[Demo] BaseSettings for AI configuration")

    try:
        from pydantic_settings import BaseSettings

        class AISettings(BaseSettings):
            openai_api_key: str
            model_name: str = "gpt-4o-mini"
            max_tokens: int = 1024
            temperature: float = 0.0
            max_retries: int = 3
            request_timeout: float = 30.0

            model_config = {"env_file": ".env"}

        settings = AISettings()
        print(f"  ✅ Settings loaded: model={settings.model_name}, max_tokens={settings.max_tokens}")
        print(f"     API key present: {'yes' if settings.openai_api_key else 'no'}")
    except ImportError:
        print("  pydantic-settings not installed. Run: pip install pydantic-settings")
    except Exception as e:
        print(f"  Settings validation failed at startup: {e}")
        print("  (This is the correct behavior — fail fast, not at request time)")


# ─── Tool Schema Pattern ──────────────────────────────────────────────────────


def demonstrate_tool_schema():
    """Show how Pydantic generates JSON Schema for LLM tool definitions."""
    print("\n[Demo] Pydantic → JSON Schema for LLM tool use")

    class WebSearchInput(BaseModel):
        """Search the web for current information on a topic."""

        query: str = Field(description="The search query string")
        max_results: int = Field(default=5, ge=1, le=20, description="Number of results")
        safe_search: bool = Field(default=True, description="Enable safe search filtering")

    schema = WebSearchInput.model_json_schema()
    print(f"  Generated schema:\n  {json.dumps(schema, indent=4)}")
    print("  → This schema is passed to the OpenAI `tools` parameter directly")


# ─── Main ─────────────────────────────────────────────────────────────────────


async def main():
    sample_text = """
    Apple Inc. announced today that CEO Tim Cook will present at the upcoming
    Worldwide Developers Conference in San Jose, California. The event, which
    features the new iPhone 16 Pro, is expected to attract major investors
    including Warren Buffett from Berkshire Hathaway.
    """

    print("=" * 60)
    print("Pydantic for LLM Output Parsing — Three Patterns")
    print("=" * 60)

    # Pattern 1: Manual prompt + parsing
    result1 = await extract_entities_manual(sample_text)
    if result1:
        for entity in result1.entities:
            print(f"    {entity.entity_type:12} | {entity.name} (confidence: {entity.confidence:.2f})")

    # Pattern 2: Structured outputs
    result2 = await extract_entities_structured(sample_text)
    if result2:
        for entity in result2.entities:
            print(f"    {entity.entity_type:12} | {entity.name}")

    # Pattern 3: What validation errors look like
    demonstrate_validation_errors()

    # Pattern 4: Settings
    demonstrate_settings()

    # Pattern 5: Tool schemas
    demonstrate_tool_schema()

    print("\n" + "=" * 60)
    print("Key Takeaway:")
    print("  LLM output → raw string → strip fences → json.loads → Pydantic")
    print("  ValidationError tells you EXACTLY what the LLM got wrong.")
    print("  Log json.JSONDecodeError and ValidationError separately in prod.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
