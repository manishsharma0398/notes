from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from .routes.ask import ask_router
from .routes.health import health_router
from .routes.documents import document_router

app = FastAPI()
app.include_router(document_router, prefix="/documents")
app.include_router(health_router, prefix="/health")
app.include_router(ask_router, prefix="/ask")
