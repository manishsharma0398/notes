from dotenv import load_dotenv
from fastapi import FastAPI
from .endpoints.review import review_router
from .endpoints.health import health_router

load_dotenv()
app = FastAPI()


app.include_router(
    router=review_router,
    prefix="/review",
)
app.include_router(
    router=health_router,
    prefix="/health",
)
