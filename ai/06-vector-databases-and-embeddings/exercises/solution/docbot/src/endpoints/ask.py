import json
from uuid import UUID
from fastapi import APIRouter, Query
from langchain_openai import ChatOpenAI
from ..controllers.documents import embed
from ..clients.qdrant import query_collections
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate
from ..utils.models import AskRequest, AskResponse, LLMResponse
from qdrant_client.models import Filter, FieldCondition, MatchValue
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser

ask_router = APIRouter()

parser = PydanticOutputParser(pydantic_object=LLMResponse)
format_instructions = parser.get_format_instructions()

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a helpful assistant that answers questions about documents.
            Answer ONLY using the provided context.

            If the answer is not in the context, return:
            {{"answer": "I don't have enough information to answer that."}}

            Always return valid JSON matching the schema. Never return plain text.

            context: \n{context}

            Output format instructions:\n{format_instructions},
            """,
        ),
        ("human", "{question}"),
    ]
).partial(format_instructions=format_instructions)
llm = ChatOpenAI()


runnable = prompt | llm | parser
runnable_stream = prompt | llm | StrOutputParser()


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
        sources.add(search.name)
        llm_context.append(search.text)
    llm_answer = await runnable.ainvoke(
        {
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


async def stream_generator(llm_context: list[str], question: str):
    async for chunk in runnable_stream.astream(
        {
            "context": llm_context,
            "question": question,
        }
    ):
        # chunk is LLMResponse partial — stream raw text or field
        yield f"data: {json.dumps({'content': str(chunk)})}\n\n"
    yield "data: [DONE]\n\n"


@ask_router.get("")
async def ask_stream(question: str = Query(), document_id: UUID = Query()):
    search_vector, _ = await embed(question)
    query_filter = None
    if document_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=str(document_id)),
                ),
            ]
        )
    searches = await query_collections(
        "docs_collection",
        query=search_vector,
        query_filter=query_filter,
    )
    llm_context = [search.text for search in searches]

    return StreamingResponse(
        content=stream_generator(llm_context, question),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disables Nginx buffering — CRITICAL
        },
    )
