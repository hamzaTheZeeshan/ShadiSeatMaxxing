from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class ErrorBody(BaseModel):
    error: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)