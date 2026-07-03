from enum import Enum
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser


class Sensitive(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class Metadata(BaseModel):
    topic: str
    key_people: list[str]
    key_places: list[str]
    sentiment: Sensitive
    word_count_estimate: int


llm = ChatOpenAI(
    temperature=0.0,
    model="gpt-40-mini",
    max_completion_tokens=500,
)


def main():
    neutral_summary = (
        ChatPromptTemplate.from_template("{text}") | llm | StrOutputParser()
    )
    critical_analysis = (
        ChatPromptTemplate.from_template("{text}") | llm | StrOutputParser()
    )
    structured_metadata_extract = (
        ChatPromptTemplate.from_template("{text}")
        | llm
        | PydanticOutputParser(pydantic_object=Metadata)
    )
    readability_assessment = (
        ChatPromptTemplate.from_template("{text}") | llm | StrOutputParser()
    )

    parallel_chain = RunnableParallel(
        neutral_summary=neutral_summary,
        critical_analysis=critical_analysis,
        readability_assessment=readability_assessment,
        structured_metadata_extract=structured_metadata_extract,
    )

    result = parallel_chain.invoke({"text": ""})

    pass


main()
