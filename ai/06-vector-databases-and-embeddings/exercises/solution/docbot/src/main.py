from fastapi import FastAPI
from .endpoints.ask import ask_router
from contextlib import asynccontextmanager
from .endpoints.search import search_router
from .clients.openai import get_openai_client
from .endpoints.documents import document_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_openai_client()
    yield
    get_openai_client().close()


app = FastAPI(title="Doc Bot", lifespan=lifespan)

app.include_router(ask_router, prefix="/ask")
app.include_router(search_router, prefix="/search")
app.include_router(document_router, prefix="/documents")
