import json
import time
import logging
from uuid import UUID, uuid4
from pydantic import RootModel
from ..clients.openai import llm
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableParallel, RunnableLambda
from ..utils.models import BatchReview, PostReview, CodeIssue, CodeReview
from langchain_core.output_parsers import (
    StrOutputParser,
    PydanticOutputParser,
    JsonOutputParser,
)

review_router = APIRouter()


reviews: dict[str, CodeReview] = {}

code_issue_list_parser = PydanticOutputParser(
    pydantic_object=RootModel[list[CodeIssue]]
)
code_issue_format_instructions = code_issue_list_parser.get_format_instructions()

logger = logging.getLogger(__name__)


def _normalize_to_list(text: str | object) -> str:
    """Ensure the LLM output is a JSON array before parsing.

    The LLM sometimes returns a chat message object instead of raw text,
    and it may also return a single JSON object when there is one issue.
    It also sometimes wraps JSON in markdown code blocks.
    This function extracts the text, strips code blocks, normalizes it,
    and wraps a single object in a JSON array if needed.
    """
    if hasattr(text, "content"):
        text = text.content
    elif hasattr(text, "output_text"):
        text = text.output_text
    elif isinstance(text, dict):
        text = text.get("content") or text.get("text") or json.dumps(text)

    if not isinstance(text, str):
        text = str(text)

    # Strip markdown code blocks
    text = text.strip()
    if text.startswith("```"):
        # Remove opening code fence (e.g. ```json)
        text = text.lstrip("`").lstrip("json").lstrip("JSON").lstrip()
        # Remove closing code fence
        text = text.rstrip("`").rstrip()

    stripped = text.strip()
    # Find the first meaningful JSON token
    start = next((i for i, c in enumerate(stripped) if c in ("{", "[")), None)
    if start is not None and stripped[start] == "{":
        # Single object — wrap it in an array
        try:
            obj = json.loads(stripped[start:])
            result = json.dumps([obj])
            return result
        except json.JSONDecodeError as e:
            print(f"[DEBUG normalize] JSON parse error: {e}", flush=True)
            pass  # Let the original parser surface a clearer error

    return text


def _validate_code_issues(parsed_list):
    """Validate and convert parsed list items to CodeIssue objects."""
    if not isinstance(parsed_list, list):
        parsed_list = [parsed_list]

    result = []
    for item in parsed_list:
        if isinstance(item, dict):
            result.append(CodeIssue(**item))
        elif isinstance(item, CodeIssue):
            result.append(item)
        else:
            result.append(CodeIssue(**json.loads(str(item))))

    return result


normalize_runnable = RunnableLambda(_normalize_to_list)
validate_code_issues_runnable = RunnableLambda(_validate_code_issues)

json_parser = JsonOutputParser()

bugs_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Review the following {language} code for bugs.\n\n"
                "Output format instructions:\n{format_instructions}",
            ),
            ("human", "{code}"),
        ],
    )
    | llm
    | normalize_runnable
    | StrOutputParser()
    | json_parser
    | validate_code_issues_runnable
)

best_practices_chain = (
    ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Review the following {language} code for best practices.\n\n"
                "Output format instructions:\n{format_instructions}",
            ),
            ("human", "{code}"),
        ],
    )
    | llm
    | normalize_runnable
    | StrOutputParser()
    | json_parser
    | validate_code_issues_runnable
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
        security="",
        error=None,
        language=payload.language,
        overall_score=2,
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
                "format_instructions": code_issue_format_instructions,
            }
        )
        data.processing_time_ms = (time.perf_counter() - start) * 1000
        data.best_practices = response.get("best_practices_chain", [])
        data.bugs = response.get("bugs_chain", [])
        data.security = response.get("security_chain", "")
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
            [
                {
                    **snippet.model_dump(),
                    "format_instructions": code_issue_format_instructions,
                }
                for snippet in payload.snippets
            ],
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
            overall_score=2,
            best_practices=response.get("best_practices_chain", []),
            bugs=response.get("bugs_chain", []),
            security=response.get("security_chain", ""),
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
