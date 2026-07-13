from fastapi import FastAPI
from .endpoints.ask import ask_router
from contextlib import asynccontextmanager
from .endpoints.search import search_router
from .clients.openai import get_openai_client
from .clients.qdrant import get_qdrant_client, create_collection
from .endpoints.documents import document_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    opeani_client = await get_openai_client()
    qdrant_client = await get_qdrant_client()
    await create_collection("docs_collection", 1536)
    yield
    await opeani_client.close()
    await qdrant_client.close()


app = FastAPI(title="Doc Bot", lifespan=lifespan)

app.include_router(ask_router, prefix="/ask")
app.include_router(search_router, prefix="/search")
app.include_router(document_router, prefix="/documents")
