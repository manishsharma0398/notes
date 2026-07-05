import time
from uuid import UUID, uuid4
from pydantic import RootModel
from ..clients.openai import llm
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from ..utils.models import BatchReview, PostReview, CodeIssue, CodeReview

review_router = APIRouter()


reviews: dict[str, CodeReview] = {}

pydantic_parser = PydanticOutputParser(pydantic_object=RootModel[list[CodeIssue]])
format_instructions = pydantic_parser.get_format_instructions()

bugs_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Review the following {language} code for bugs. Follow these instructions: {format_instructions}",
            ),
            ("human", "{code}"),
        ],
    ).partial(format_instructions=format_instructions)
    | llm
    | pydantic_parser
    | (lambda x: x.root)
)

best_practices_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Review the following {language} code for best practices. Follow these instructions: {format_instructions}",
            ),
            ("human", "{code}"),
        ],
    ).partial(format_instructions=format_instructions)
    | llm
    | pydantic_parser
    | (lambda x: x.root)
)

security_chain = (
    ChatPromptTemplate.from_template(
        "Review the following {language} code for security concerns:\n {code}"
    )
    | llm
    | StrOutputParser()
)

parallel_analyzer = RunnableParallel(
    bugs_chain=bugs_chain,
    best_practices_chain=best_practices_chain,
    security_chain=security_chain,
)


async def stream_security_analysis(payload: PostReview):
    for i in security_chain.stream(
        {
            "code": payload.code,
            "language": payload.language,
        }
    ):
        yield f"data: {i}\n\n"
    yield "data: [DONE]\n\n"


async def process_document_task(review_id, payload: PostReview):
    data = CodeReview(
        review_id=review_id,
        best_practices=[],
        bugs=[],
        security=[],
        error=None,
        language=payload.language,
        overall_score=0,
        processing_time_ms=0,
        success=True,
        summary="",
    )
    start = time.perf_counter()
    try:
        response = await parallel_analyzer.ainvoke(
            {
                "code": payload.code,
                "language": payload.language,
            }
        )
        data.processing_time_ms = (time.perf_counter() - start) * 1000
        data.best_practices = response.get("best_practices_chain", [])
        data.bugs = response.get("bugs_chain", [])
        data.security = response.get("security_chain", [])
    except Exception as e:
        data.processing_time_ms = (time.perf_counter() - start) * 1000
        data.success = False
        data.error = f"{e}"
        return {
            "success": False,
            "error": f"{e}",
        }
    finally:
        reviews[str(review_id)] = data


@review_router.post(path="")
async def post_single_review(
    payload: PostReview,
    background_tasks: BackgroundTasks,
):
    review_id = uuid4()
    background_tasks.add_task(process_document_task, review_id, payload)
    return StreamingResponse(
        stream_security_analysis(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
            "X-request-id": f"{review_id}",
        },
    )


@review_router.post(
    path="/batch",
)
async def post_batch_review(payload: BatchReview):
    try:
        start = time.perf_counter()
        responses = await parallel_analyzer.abatch(
            [snippet.model_dump() for snippet in payload.snippets],
            config={
                "max_concurrency": 3,
            },
        )
    except Exception as e:
        return {
            "success": False,
            "error": f"{e}",
        }

    processing_time = (time.perf_counter() - start) * 1000

    result = []
    for snippet, response in zip(payload.snippets, responses):
        review_id = uuid4()

        data = CodeReview(
            review_id=review_id,
            language=snippet.language,
            overall_score=0,
            best_practices=response.get("best_practices_chain", []),
            bugs=response.get("bugs_chain", []),
            security=response.get("security_chain", []),
            error=None,
            processing_time_ms=processing_time,
            success=True,
            summary="",
        )
        reviews[str(review_id)] = data
        result.append(data)

    return result


@review_router.get(
    path="/{review_id}",
    response_model=CodeReview,
)
def get_review(review_id: UUID):
    return reviews[str(review_id)]
