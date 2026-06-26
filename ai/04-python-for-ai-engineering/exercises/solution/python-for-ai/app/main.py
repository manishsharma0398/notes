from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import json

app = FastAPI()

class ClassifyPrompt(BaseModel):
    user_query: List[str]

@app.post("/classify")
def classify_route(p: ClassifyPrompt):
    return {"status": json.dumps(p.user_query)}