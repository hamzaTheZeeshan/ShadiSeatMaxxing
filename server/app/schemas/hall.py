import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.hall import Hall
from app.schemas.layout import HallDimension, HallLayout


class HallCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wedding_id: uuid.UUID
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    width: HallDimension
    height: HallDimension


class LayoutUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layout: HallLayout
    expected_version: Annotated[int, Field(strict=True, ge=1)]


class HallSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    width: float
    height: float
    layout_version: int
    updated_at: datetime


class HallDetail(HallSummary):
    wedding_id: uuid.UUID
    unit: str
    created_at: datetime
    layout: HallLayout

    @classmethod
    def from_hall(cls, hall: Hall) -> "HallDetail":
        return cls(
            id=hall.id,
            name=hall.name,
            width=hall.width,
            height=hall.height,
            layout_version=hall.layout_version,
            updated_at=hall.updated_at,
            wedding_id=hall.wedding_id,
            unit=hall.unit,
            created_at=hall.created_at,
            layout=HallLayout.model_validate(hall.layout_json),
        )