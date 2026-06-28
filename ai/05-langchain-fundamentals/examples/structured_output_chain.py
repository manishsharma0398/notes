# examples/structured_output_chain.py
# Chapter 5: LangChain Fundamentals
#
# Demonstrates: JsonOutputParser, PydanticOutputParser, OutputFixingParser
# and the streaming behaviour difference between them.
# Requirements: pip install langchain-core langchain-openai pydantic python-dotenv
# Run: python examples/structured_output_chain.py

import asyncio
import json
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from typing import Literal

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, max_tokens=256)


# ------------------------------------------------------------------
# 1. JsonOutputParser — no schema, just parses JSON
# ------------------------------------------------------------------

def demo_json_parser() -> None:
    print("\n=== JsonOutputParser ===")

    json_parser = JsonOutputParser()
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Respond ONLY with valid JSON. No markdown fences."),
        ("human", "Return a JSON object with fields: name (str), year (int), category (str). "
                  "Describe: {topic}"),
    ])

    chain = prompt | llm | json_parser

    result = chain.invoke({"topic": "the invention of the transformer architecture"})
    print(f"Parsed dict: {result}")
    print(f"Type: {type(result)}")        # dict
    print(f"Year: {result.get('year')}")  # int


# ------------------------------------------------------------------
# 2. PydanticOutputParser — parses AND validates schema
# ------------------------------------------------------------------

class TechReview(BaseModel):
    tool_name: str = Field(description="Name of the tool being reviewed")
    rating: int = Field(description="Rating from 1-10", ge=1, le=10)
    pros: list[str] = Field(description="List of advantages")
    cons: list[str] = Field(description="List of disadvantages")
    verdict: Literal["use_it", "avoid_it", "situational"] = Field(
        description="Final verdict"
    )


def demo_pydantic_parser() -> None:
    print("\n=== PydanticOutputParser ===")

    pydantic_parser = PydanticOutputParser(pydantic_object=TechReview)

    # PydanticOutputParser generates format instructions automatically
    format_instructions = pydantic_parser.get_format_instructions()
    print("Format instructions injected into prompt:")
    print(format_instructions[:300], "...")  # truncated for readability

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a senior engineer reviewing developer tools."),
        ("human",
         "Write a technical review of {tool}.\n\n"
         "Output format instructions:\n{format_instructions}"),
    ])

    chain = prompt | llm | pydantic_parser

    result = chain.invoke({
        "tool": "LangChain",
        "format_instructions": format_instructions,
    })

    print(f"\nResult type: {type(result).__name__}")
    print(f"Tool: {result.tool_name}")
    print(f"Rating: {result.rating}/10")
    print(f"Pros: {result.pros}")
    print(f"Cons: {result.cons}")
    print(f"Verdict: {result.verdict}")
    # result is a fully validated TechReview Pydantic model


# ------------------------------------------------------------------
# 3. Streaming comparison: StrOutputParser vs JsonOutputParser
#
# KEY POINT: JsonOutputParser CAN stream (yields partial dicts).
#            PydanticOutputParser CANNOT stream (must buffer for validation).
# ------------------------------------------------------------------

async def demo_streaming_parsers() -> None:
    print("\n=== Streaming: StrOutputParser vs JsonOutputParser ===")

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Respond only with valid JSON. No markdown."),
        ("human", "Return a JSON with 3 fields: topic, summary (50 words), tags (list of 3 strings). "
                  "Topic: {topic}"),
    ])

    # StrOutputParser streaming — raw token fragments
    str_chain = prompt | llm | StrOutputParser()
    print("\n[StrOutputParser chunks]:")
    chunk_count = 0
    async for chunk in str_chain.astream({"topic": "transformer attention mechanism"}):
        print(repr(chunk), end=" ")
        chunk_count += 1
    print(f"\n-> {chunk_count} chunks received")

    # JsonOutputParser streaming — yields progressively complete dicts
    json_chain = prompt | llm | JsonOutputParser()
    print("\n[JsonOutputParser chunks]:")
    last_chunk = None
    chunk_count = 0
    async for chunk in json_chain.astream({"topic": "transformer attention mechanism"}):
        last_chunk = chunk
        chunk_count += 1
        # Each chunk is a dict, increasingly complete
        print(f"  Chunk {chunk_count}: {chunk}")
    print(f"-> Final dict: {last_chunk}")


# ------------------------------------------------------------------
# 4. Handling OutputParserException — the correct production pattern
# ------------------------------------------------------------------

def demo_parser_error_handling() -> None:
    print("\n=== OutputParserException Handling ===")
    from langchain_core.exceptions import OutputParserException

    pydantic_parser = PydanticOutputParser(pydantic_object=TechReview)
    format_instructions = pydantic_parser.get_format_instructions()

    # Deliberately broken prompt — will likely produce wrong schema
    bad_prompt = ChatPromptTemplate.from_messages([
        ("human", "Say something random about {tool}. Ignore all format instructions."),
    ])
    bad_chain = bad_prompt | llm | pydantic_parser

    try:
        result = bad_chain.invoke({
            "tool": "LangChain",
            "format_instructions": format_instructions,
        })
    except OutputParserException as e:
        print(f"OutputParserException caught!")
        print(f"LLM output that failed parsing: {str(e)[:200]}...")
        print("-> In production: log this, return error, optionally retry")
    except Exception as e:
        print(f"Other error: {type(e).__name__}: {e}")


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

async def main() -> None:
    demo_json_parser()
    demo_pydantic_parser()
    await demo_streaming_parsers()
    demo_parser_error_handling()


if __name__ == "__main__":
    asyncio.run(main())
