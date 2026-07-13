from fastapi import APIRouter
from ..utils.models import AskRequest, AskResponse, LLMResponse
from ..controllers.documents import embed
from ..clients.qdrant import query_collections
from qdrant_client.models import Filter, FieldCondition, MatchValue
from langchain_core.prompts import ChatPromptTemplate

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser

ask_router = APIRouter()

parser = PydanticOutputParser(pydantic_object=LLMResponse)

instructions = parser.get_format_instructions()

prompt = ChatPromptTemplate(
    messages=[
        (
            "system",
            """You are a helpful assistant that answers questions about documents.
            Answer ONLY using the provided context. If the answer is not in the context,
            say exactly: "I don't have enough information to answer that."
            Always cite which source document you used.

            context: \n{context}

            Output format instructions:\n{format_instructions},
            """,
        ),
        ("human", "{question}"),
    ]
)
llm = ChatOpenAI()


runnable = prompt | llm | parser


@ask_router.post("", response_model=AskResponse)
async def ask(payload: AskRequest):
    search_vector, _ = await embed(payload.question)
    query_filter = None
    if payload.document_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=str(payload.document_id)),
                ),
            ]
        )
    searches = await query_collections(
        "docs_collection",
        query=search_vector,
        query_filter=query_filter,
        top_k=payload.top_k,
    )
    llm_context = []
    chunks_used = 0
    sources = set()
    for search in searches:
        chunks_used += 1
        sources.add(search.payload.get("name", ""))
        llm_context.append(search.payload.get("text", ""))
    llm_answer = await runnable.ainvoke(
        {
            "format_instructions": instructions,
            "context": llm_context,
            "question": payload.question,
        }
    )
    return AskResponse(
        answer=llm_answer.answer,
        sources=list(sources),
        chunks_used=chunks_used,
        question=payload.question,
    )


@ask_router.get("")
def ask_stream():
    pass
