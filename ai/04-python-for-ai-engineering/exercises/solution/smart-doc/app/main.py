from uuid import uuid4
from dotenv import load_dotenv
from .utils.logger import logger
from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from .utils.context_vars import req_id_context
from .clients.openai import get_openai_client, close_openai_client

load_dotenv()

from .routes.ask import ask_router
from .routes.health import health_router
from .routes.documents import document_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_openai_client()
    yield
    await close_openai_client()


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def log_request(req: Request, call_next):
    id = str(uuid4())
    req_id_context.set(id)
    logger.info(
        "Incoming request",
        extra={
            "method": req.method,
            "url": req.url,
            "query_params": req.query_params,
            "headers": req.headers,
        },
    )

    logger.debug("Incoming Event", extra=dict(context=req.scope))

    response = await call_next(req)

    logger.info(
        "Request Outcome",
        extra={
            "method": req.method,
            "url": req.url,
            "query_params": req.query_params,
            "headers": req.headers,
            "status_code": response.status_code,
        },
    )
    return response


app.include_router(document_router, prefix="/documents")
app.include_router(health_router, prefix="/health")
app.include_router(ask_router, prefix="/ask")
