from fastapi import FastAPI
from .endpoints.ask import ask_router
from .endpoints.documents import document_router
from .endpoints.search import search_router

app = FastAPI(title="Doc Bot")
app.include_router(ask_router, prefix="/ask")
app.include_router(search_router, prefix="/search")
app.include_router(document_router, prefix="/documents")
