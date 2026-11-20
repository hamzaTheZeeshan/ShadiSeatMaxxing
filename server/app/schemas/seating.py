from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constraint import ValidateConstraintsRequest
from app.schemas.guest import MAX_GUESTS, GuestId
from app.schemas.layout import Number, ObjectId

SolveStatus = Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "MODEL_INVALID", "UNKNOWN"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LockedAssignment(_Strict):
    guest_id: GuestId
    table_object_id: ObjectId


class SolveOptions(_Strict):
    # Clamped to 1..60 by the service; None means the configured default.
    time_limit_seconds: Number | None = None


class SolveRequest(ValidateConstraintsRequest):
    locked_assignments: Annotated[list[LockedAssignment], Field(max_length=MAX_GUESTS)] = Field(
        default_factory=list
    )
    options: SolveOptions = Field(default_factory=SolveOptions)


class Assignment(BaseModel):
    guest_id: str
    table_object_id: str


class PenaltyEntry(BaseModel):
    rule_id: str
    penalty: float


class Notice(BaseModel):
    code: str
    message: str
    rule_ids: list[str]


class SolveResponse(BaseModel):
    status: SolveStatus
    optimality_proven: bool
    assignments: list[Assignment]
    unassigned_guest_ids: list[str]
    objective_value: float | None
    penalties: list[PenaltyEntry]
    warnings: list[Notice]
    diagnostics: list[Notice]