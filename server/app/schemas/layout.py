import math
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictInt,
    StringConstraints,
    model_validator,
)
from typing_extensions import Self

Real = int | float


def _finite(value: Real) -> Real:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("must be a finite number")
    return value


def _positive(value: Real) -> Real:
    _finite(value)
    if value <= 0:
        raise ValueError("must be greater than 0")
    return value


def _hall_dimension(value: Real) -> Real:
    _finite(value)
    if not 5 <= value <= 500:
        raise ValueError("must be between 5 and 500")
    return value


# Strict int/float keeps numbers exactly as sent and rejects bools and strings.
Number = Annotated[StrictInt | StrictFloat, AfterValidator(_finite)]
PositiveNumber = Annotated[StrictInt | StrictFloat, AfterValidator(_positive)]
HallDimension = Annotated[StrictInt | StrictFloat, AfterValidator(_hall_dimension)]

ObjectId = Annotated[str, StringConstraints(pattern=r"^[a-z_]+_[A-Za-z0-9-]{4,36}$")]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HallInfo(_Strict):
    id: str = Field(min_length=1, max_length=64)
    # The editor allows an empty hall name, so the server does too.
    name: str = Field(max_length=200)
    width: HallDimension
    height: HallDimension
    unit: Literal["m"]


class _ObjectBase(_Strict):
    id: ObjectId
    x: Number  # center
    y: Number  # center
    rotation: Number  # degrees clockwise about the center


class TableObject(_ObjectBase):
    type: Literal["table"]
    shape: Literal["round", "square", "rectangular"]
    radius: PositiveNumber | None = None
    width: PositiveNumber | None = None
    height: PositiveNumber | None = None
    capacity: Annotated[int, Field(strict=True, ge=1, le=30)]

    @model_validator(mode="after")
    def _check_shape(self) -> Self:
        if self.shape == "round":
            if self.radius is None:
                raise ValueError("round table requires radius")
            if self.width is not None or self.height is not None:
                raise ValueError("round table must not have width or height")
        else:
            if self.width is None or self.height is None:
                raise ValueError(f"{self.shape} table requires width and height")
            if self.radius is not None:
                raise ValueError(f"{self.shape} table must not have radius")
        return self


class _BoxObject(_ObjectBase):
    width: PositiveNumber
    height: PositiveNumber


class StageObject(_BoxObject):
    type: Literal["stage"]


class DanceFloorObject(_BoxObject):
    type: Literal["dance_floor"]


class RestrictedAreaObject(_BoxObject):
    type: Literal["restricted_area"]


class ServiceAreaObject(_BoxObject):
    type: Literal["service_area"]


class EntranceObject(_ObjectBase):
    type: Literal["entrance"]
    width: PositiveNumber


class ExitObject(_ObjectBase):
    type: Literal["exit"]
    width: PositiveNumber


AnyObject = (
    TableObject
    | StageObject
    | DanceFloorObject
    | RestrictedAreaObject
    | ServiceAreaObject
    | EntranceObject
    | ExitObject
)

LayoutObject = Annotated[AnyObject, Field(discriminator="type")]


class HallLayout(_Strict):
    schema_version: Literal[1]
    hall: HallInfo
    objects: Annotated[list[LayoutObject], Field(max_length=500)]

    @model_validator(mode="after")
    def _unique_ids(self) -> Self:
        ids = [obj.id for obj in self.objects]
        if len(set(ids)) != len(ids):
            raise ValueError("object ids must be unique within a layout")
        return self