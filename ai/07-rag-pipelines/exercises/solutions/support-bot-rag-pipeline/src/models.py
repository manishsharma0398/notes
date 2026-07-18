from pydantic import BaseModel


class IngestedDoc(BaseModel):
    source: str
    text: str
