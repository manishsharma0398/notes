from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .endpoints.review import review_router
from .endpoints.health import health_router

load_dotenv()
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    router=review_router,
    prefix="/review",
)
app.include_router(
    router=health_router,
    prefix="/health",
)
