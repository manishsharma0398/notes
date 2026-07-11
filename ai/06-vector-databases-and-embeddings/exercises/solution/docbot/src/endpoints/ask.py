from fastapi import APIRouter

ask_router = APIRouter()


@ask_router.post("")
def ask():
    pass


@ask_router.get("")
def ask_stream():
    pass
