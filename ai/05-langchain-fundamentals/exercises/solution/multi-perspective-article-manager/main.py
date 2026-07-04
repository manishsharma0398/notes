import asyncio
from enum import Enum
from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from langchain_core.runnables import RunnableParallel
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser

load_dotenv()


class Sensitive(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class ArticleMetadata(BaseModel):
    topic: str
    key_people: list[str]
    key_places: list[str]
    sentiment: Sensitive
    word_count_estimate: int


llm = ChatOpenAI(
    temperature=0.0,
    model="gpt-4o-mini",
    max_completion_tokens=500,
)

summary_chain = (
    ChatPromptTemplate.from_template(
        "You are an artcle analyzer. You will be provided with an article and you need to summarize it neutrally with only facts and no any opinion of your own: {article}"
    )
    | llm
    | StrOutputParser()
)
critical_chain = (
    ChatPromptTemplate.from_template(
        "You are an artcle analyzer. You will be provided with an article and you need to do a critical analysis of it. You need to do a critical analyzer and find out what's missing or what's questionable: {article}"
    )
    | llm
    | StrOutputParser()
)
readability_chain = (
    ChatPromptTemplate.from_template(
        "You are an artcle analyzer. You will be provided with an article and you need to do a readability analysis of it. You need to do the assessment of reading lvel, audience and clarity score: {article}"
    )
    | llm
    | StrOutputParser()
)

pydantic_parser = PydanticOutputParser(pydantic_object=ArticleMetadata)
format_instructions = pydantic_parser.get_format_instructions()

metadata_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Extract structured metadata from the article. {format_instructions}",
            ),
            ("human", "{article}"),
        ]
    ).partial(format_instructions=format_instructions)
    | llm
    | pydantic_parser
)


parallel_analyzer = RunnableParallel(
    summary=summary_chain,
    critical=critical_chain,
    readability=readability_chain,
    metadata=metadata_chain,
)


def verify_schemas() -> None:
    print("Parallel analyzer input schema:")
    print(parallel_analyzer.input_schema.schema())


async def stream_critical_analysis(article: str) -> None:
    print("Streaming critical analysis:")
    async for chain in critical_chain.astream({"article": article}):
        print(chain, end="", flush=True)


async def analyze_article(article: str) -> dict:
    try:
        result = await parallel_analyzer.ainvoke({"article": article})
        return result
    except OutputParserException as e:
        print(f"OutputParserException caught!")
        print(f"LLM output that failed parsing: {str(e)[:200]}...")
        print("-> In production: log this, return error, optionally retry")
    except Exception as e:
        print(f"Other error: {type(e).__name__}: {e}")

    return {}


async def main():

    verify_schemas()

    with open("article.txt", "r", encoding="utf-8") as data:
        article = data.read()

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


asyncio.run(main())
