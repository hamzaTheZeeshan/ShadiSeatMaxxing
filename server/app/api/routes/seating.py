from fastapi import APIRouter

from app.schemas.common import ErrorBody
from app.schemas.seating import SolveRequest, SolveResponse
from app.services import seating_service

router = APIRouter(tags=["seating"])


# Sync def: FastAPI runs it in its threadpool, so the CPU-bound solve does not block the event loop.
@router.post("/solve", response_model=SolveResponse, responses={422: {"model": ErrorBody}})
def solve(payload: SolveRequest) -> SolveResponse:
    return seating_service.solve(payload)