from fastapi import APIRouter

from app.schemas.common import ErrorBody
from app.schemas.constraint import ValidateConstraintsRequest, ValidateConstraintsResponse
from app.schemas.validation import ValidateLayoutRequest, ValidateLayoutResponse
from app.services import constraint_validation_service, validation_service

router = APIRouter(prefix="/validate", tags=["validation"])


@router.post("/layout", response_model=ValidateLayoutResponse, responses={422: {"model": ErrorBody}})
def validate_layout(payload: ValidateLayoutRequest) -> ValidateLayoutResponse:
    return validation_service.validate_layout(payload.layout)


# exclude_none drops ruleId from issues that have no rule, matching the editor's optional field.
@router.post(
    "/constraints",
    response_model=ValidateConstraintsResponse,
    response_model_exclude_none=True,
    responses={422: {"model": ErrorBody}},
)
def validate_constraints(payload: ValidateConstraintsRequest) -> ValidateConstraintsResponse:
    return constraint_validation_service.run_validation(payload)