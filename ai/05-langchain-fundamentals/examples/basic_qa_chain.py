# examples/basic_qa_chain.py
# Chapter 5: LangChain Fundamentals
#
# Demonstrates: LCEL chain composition, async batch, streaming
# Requirements: pip install langchain-core langchain-openai python-dotenv
# Run: python examples/basic_qa_chain.py

import asyncio
import os
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

load_dotenv()

# ------------------------------------------------------------------
# 1. Define components (no API calls happen here — just configuration)
# ------------------------------------------------------------------

SYSTEM_PROMPT = """You are a technical documentation assistant.
Answer questions based only on the provided context.
If the context does not contain enough information, say exactly:
"I don't have enough context to answer this."
Be concise and precise. Maximum 2 sentences."""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "Context:\n{context}\n\nQuestion: {question}"),
])

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,     # deterministic output
    max_tokens=256,      # cost control
)

parser = StrOutputParser()

# ------------------------------------------------------------------
# 2. Build the chain — lazy, no API call yet
#
#    chain.input_schema.schema() reveals required keys:
#    {"context": str, "question": str}
# ------------------------------------------------------------------

chain = prompt | llm | parser

# Inspect the chain's expected input schema
print("Chain expects:", chain.input_schema.schema())
# -> {'properties': {'context': {'title': 'Context', 'type': 'string'},
#                    'question': {'title': 'Question', 'type': 'string'}}, ...}


# ------------------------------------------------------------------
# 3. Single invoke (sync)
# ------------------------------------------------------------------

def demo_single_invoke(context: str) -> None:
    print("\n=== Single Invoke ===")
    result = chain.invoke({
        "context": context,
        "question": "What does LCEL stand for?",
    })
    print(f"Answer: {result}")


# ------------------------------------------------------------------
# 4. Async batch — multiple questions answered concurrently
# ------------------------------------------------------------------

async def demo_async_batch(context: str, questions: list[str]) -> None:
    print("\n=== Async Batch (Concurrent) ===")
    inputs = [{"context": context, "question": q} for q in questions]

    # abatch issues all calls concurrently, up to max_concurrency
    results = await chain.abatch(
        inputs,
        config={"max_concurrency": 3},
    )

    for q, a in zip(questions, results):
        print(f"Q: {q}")
        print(f"A: {a}\n")


# ------------------------------------------------------------------
# 5. Streaming — receive tokens as they arrive
# ------------------------------------------------------------------

async def demo_streaming(context: str, question: str) -> None:
    print("\n=== Streaming Answer ===")
    print(f"Q: {question}")
    print("A: ", end="", flush=True)

    async for chunk in chain.astream({"context": context, "question": question}):
        # chunk is a str fragment from StrOutputParser
        print(chunk, end="", flush=True)

    print()  # newline at end


# ------------------------------------------------------------------
# 6. Demonstrate what happens with wrong input keys
# ------------------------------------------------------------------

def demo_wrong_input() -> None:
    print("\n=== Wrong Input Key Demo ===")
    try:
        # KeyError will surface from inside the prompt template
        chain.invoke({"wrong_key": "This will fail"})
    except Exception as e:
        print(f"Error type: {type(e).__name__}")
        print(f"Error: {e}")
        print("-> Fails at runtime, not at chain-definition time")


# ------------------------------------------------------------------
# 7. Inspect the chain's structure
# ------------------------------------------------------------------

def demo_chain_inspection() -> None:
    print("\n=== Chain Inspection ===")
    print("Chain type:", type(chain).__name__)  # RunnableSequence
    print("Steps:")
    for i, step in enumerate(chain.steps):
        print(f"  [{i}] {type(step).__name__}")
    # Output:
    #   [0] ChatPromptTemplate
    #   [1] ChatOpenAI
    #   [2] StrOutputParser


# ------------------------------------------------------------------
# 8. RunnableParallel — two chains on the same input simultaneously
# ------------------------------------------------------------------

async def demo_parallel_chains(context: str) -> None:
    from langchain_core.runnables import RunnableParallel

    print("\n=== RunnableParallel ===")

    summary_prompt = ChatPromptTemplate.from_template(
        "Summarize in one sentence: {text}"
    )
    keywords_prompt = ChatPromptTemplate.from_template(
        "List exactly 3 keywords (comma-separated) from: {text}"
    )

    summary_chain = summary_prompt | llm | parser
    keywords_chain = keywords_prompt | llm | parser

    parallel = RunnableParallel(
        summary=summary_chain,
        keywords=keywords_chain,
    )

    # Both chains run concurrently on the same input
    result = await parallel.ainvoke({"text": context})
    print(f"Summary:  {result['summary']}")
    print(f"Keywords: {result['keywords']}")


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

async def main() -> None:
    context = """
    LangChain Expression Language (LCEL) is a declarative way to compose chains
    in LangChain. It was introduced in LangChain v0.1 and is now the recommended
    approach for building pipelines. LCEL chains implement the Runnable interface,
    which provides .invoke(), .batch(), .stream(), and their async equivalents.
    The pipe operator (|) is used to compose Runnable components into sequences.
    RunnableParallel allows running multiple chains on the same input concurrently.
    """

    questions = [
        "What does LCEL stand for?",
        "What interface do LCEL chains implement?",
        "When was LCEL introduced?",
        "What operator is used for chain composition?",
    ]

    demo_chain_inspection()
    demo_single_invoke(context)
    demo_wrong_input()
    await demo_async_batch(context, questions)
    await demo_streaming(context, "What is the main benefit of the Runnable interface?")
    await demo_parallel_chains(context)


if __name__ == "__main__":
    asyncio.run(main())
