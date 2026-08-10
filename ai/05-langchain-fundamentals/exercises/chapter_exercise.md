# Chapter 5 Exercise — LangChain Fundamentals

**Scope:** LCEL chains · Runnable protocol · output parsers · streaming · parallel execution  
**Estimated time:** 30–60 minutes  
**Rules:** Write all code yourself. Do not use AI to generate the solution.

---

## Problem: Multi-Perspective Article Analyzer

You work at a news tech company. Editors need a tool that reads a news article and simultaneously produces four analyses from different perspectives — and streams one of them live to the user.

### Background

The editorial team receives long-form articles. For each article, they need:
1. A **neutral summary** (factual, no opinion)
2. A **critical analysis** (what's missing, what's questionable)
3. A **structured metadata extract** (topic, key people, key places, sentiment)
4. A **readability assessment** (reading level, audience, clarity score)

Items 1, 2, and 4 should run **in parallel**. Item 3 must return a **typed Pydantic model** (not a raw string).

One of the analyses (your choice) must be delivered as a **streaming** response.

---

## Acceptance Criteria

- [ ] A `RunnableParallel` runs at least 3 chains concurrently
- [ ] One chain uses `JsonOutputParser` or `PydanticOutputParser` to produce structured output
- [ ] The structured output is accessible as a Python object (not a string you `.get()` on)
- [ ] Streaming works: calling `.astream()` on one of the chains yields partial output token-by-token
- [ ] All four analyses are produced from a single input (the article text)
- [ ] Input/output contracts are verified with `chain.input_schema.schema()`
- [ ] The final output merges all four analyses into a single dict
- [ ] The code handles the case where one parallel branch fails gracefully (no 500-style crash)

---

## Data Contract

Define a Pydantic model for the metadata extraction. It must include at least:
- `topic`: str — the main topic of the article
- `key_people`: list[str] — names of people mentioned
- `key_places`: list[str] — locations mentioned
- `sentiment`: Literal["positive", "negative", "neutral", "mixed"]
- `word_count_estimate`: int

---

## Starter Skeleton

Save as `exercises/solution/analyzer.py`:

```python
import asyncio
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser, PydanticOutputParser
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing import Literal

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, max_tokens=512)


# TODO: Define your ArticleMetadata Pydantic model here
class ArticleMetadata(BaseModel):
    pass  # Fill in the fields


# TODO: Define 4 prompt templates:
# - summary_prompt: neutral factual summary
# - critical_prompt: critical analysis
# - metadata_prompt: structured metadata extraction
# - readability_prompt: reading level / audience / clarity

summary_prompt = ChatPromptTemplate.from_messages(...)
critical_prompt = ChatPromptTemplate.from_messages(...)
metadata_prompt = ChatPromptTemplate.from_messages(...)
readability_prompt = ChatPromptTemplate.from_messages(...)


# TODO: Build 4 chains (one per analysis type)
# - summary_chain: prompt | llm | StrOutputParser()
# - critical_chain: prompt | llm | StrOutputParser()
# - metadata_chain: must return a validated ArticleMetadata object
# - readability_chain: prompt | llm | StrOutputParser()

summary_chain = ...
critical_chain = ...
metadata_chain = ...
readability_chain = ...


# TODO: Build a RunnableParallel that runs at least 3 chains concurrently
# Hint: all chains receive {"article": article_text}
parallel_analyzer = RunnableParallel(
    summary=...,
    critical=...,
    metadata=...,
    readability=...,
)


# TODO: Implement async function that runs all analyses and returns combined result
async def analyze_article(article: str) -> dict:
    # Run the parallel chain
    # Handle the case where one branch might fail
    # Return a dict with keys: summary, critical, metadata, readability
    pass


# TODO: Implement streaming for the critical_chain
# Print tokens to stdout as they arrive
async def stream_critical_analysis(article: str) -> None:
    print("Streaming critical analysis:")
    # Use .astream() on critical_chain
    pass


# TODO: Inspect input schema to verify all chains expect {"article": str}
def verify_schemas() -> None:
    print("Parallel analyzer input schema:")
    print(parallel_analyzer.input_schema.schema())


async def main():
    article = """
    The European Union announced yesterday that it will introduce sweeping new regulations
    on artificial intelligence systems used in hiring decisions. The rules, set to take effect
    in 2026, will require companies to disclose when AI is used in recruitment and give
    rejected candidates the right to request human review. Critics argue the regulations
    don't go far enough, while industry groups warn they could stifle innovation and force
    smaller companies out of the EU market. EU Commissioner Maria Kovacs called the rules
    "a balanced approach that protects workers without hampering progress."
    """

    verify_schemas()
    await stream_critical_analysis(article)

    results = await analyze_article(article)

    print("\n=== Summary ===")
    print(results["summary"])

    print("\n=== Critical Analysis ===")
    print(results["critical"])

    print("\n=== Metadata ===")
    meta: ArticleMetadata = results["metadata"]
    print(f"Topic: {meta.topic}")
    print(f"People: {meta.key_people}")
    print(f"Places: {meta.key_places}")
    print(f"Sentiment: {meta.sentiment}")

    print("\n=== Readability ===")
    print(results["readability"])


if __name__ == "__main__":
    asyncio.run(main())
```

---

## What to Verify (Self-Assessment Checklist)

```bash
# Install dependencies first:
pip install langchain-core langchain-openai python-dotenv

# Run:
python exercises/solution/analyzer.py
```

- [ ] Does `verify_schemas()` print a schema showing `article` as the required input?
- [ ] Does streaming work? Do you see tokens arriving one by one before the full analysis prints?
- [ ] Is `results["metadata"]` an `ArticleMetadata` Python object (not a string or dict)?
- [ ] Does `meta.topic` return a string (not `None`)?
- [ ] Does `meta.sentiment` return one of the Literal values?
- [ ] If you temporarily break `metadata_prompt` to produce invalid JSON, does the code crash or handle it gracefully?
- [ ] Does the total wall-clock time for `analyze_article()` prove parallel execution? (It should be ~1 LLM call's latency, not 4×)

---

## Hints

<details>
<summary>Hint 1 — Building the metadata chain with PydanticOutputParser</summary>

```python
pydantic_parser = PydanticOutputParser(pydantic_object=ArticleMetadata)
format_instructions = pydantic_parser.get_format_instructions()

metadata_prompt = ChatPromptTemplate.from_messages([
    ("system", "Extract structured metadata from the article.\n{format_instructions}"),
    ("human", "{article}"),
]).partial(format_instructions=format_instructions)

metadata_chain = metadata_prompt | llm | pydantic_parser
```

The `.partial()` call pre-fills `format_instructions` so the chain only needs `{"article": ...}` as input.

</details>

<details>
<summary>Hint 2 — Graceful failure handling for one branch</summary>

Wrap individual branch chains in a try/except using `RunnableLambda`:

```python
from langchain_core.runnables import RunnableLambda

def safe_metadata(input_dict):
    try:
        return metadata_chain.invoke(input_dict)
    except Exception as e:
        return ArticleMetadata(
            topic="parse_error",
            key_people=[],
            key_places=[],
            sentiment="neutral",
            word_count_estimate=0,
        )

safe_metadata_chain = RunnableLambda(safe_metadata)
```

</details>

<details>
<summary>Hint 3 — Streaming one specific chain</summary>

```python
async for chunk in critical_chain.astream({"article": article}):
    print(chunk, end="", flush=True)
print()  # newline when done
```

`StrOutputParser` streams, so each `chunk` is a str fragment. `PydanticOutputParser` does NOT stream — use `StrOutputParser` for the chain you want to stream.

</details>

<details>
<summary>Hint 4 — Using .partial() to pre-fill template variables</summary>

When your metadata prompt has `{format_instructions}` and `{article}`, but you want the chain's public interface to only require `{article}`:

```python
prompt_with_instructions = metadata_prompt.partial(
    format_instructions=pydantic_parser.get_format_instructions()
)
# Now: prompt_with_instructions.input_variables == ["article"]
```

</details>
