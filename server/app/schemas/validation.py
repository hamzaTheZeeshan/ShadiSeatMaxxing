from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.layout import HallLayout

Severity = Literal["error", "warning"]
IssueCode = Literal[
    "out_of_bounds",
    "overlap",
    "table_in_restricted",
    "table_blocks_opening",
    "narrow_aisle",
    "near_opening",
]


class ValidateLayoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layout: HallLayout


class ValidationIssue(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    code: IssueCode
    severity: Severity
    # camelCase on the wire to match the editor's ValidationIssue type.
    object_ids: list[str] = Field(alias="objectIds")
    message: str


class ValidationSummary(BaseModel):
    errors: int
    warnings: int


class ValidateLayoutResponse(BaseModel):
    valid: bool
    summary: ValidationSummary
    issues: list[ValidationIssue]