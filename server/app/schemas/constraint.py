import math
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StringConstraints,
    model_validator,
)
from typing_extensions import Self

from app.schemas.guest import MAX_GUESTS, Guest, GuestId
from app.schemas.layout import HallLayout, ObjectId

MAX_RULES = 2000
TOGETHER_MIN_GUESTS = 2
TOGETHER_MAX_GUESTS = 20

Zone = Literal["men", "women", "family", "mixed"]
RuleKind = Literal["together", "apart"]
RuleStrength = Literal["must", "prefer"]
DEFAULT_ZONE: Zone = "mixed"


def _distance(value: int | float) -> int | float:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("must be a finite number")
    if not 1 <= value <= 50:
        raise ValueError("Distance must be between 1 and 50 metres.")
    return value


Distance = Annotated[StrictInt | StrictFloat, AfterValidator(_distance)]
SettingWeight = Annotated[int, Field(strict=True, ge=0, le=10)]
RuleWeight = Annotated[int, Field(strict=True, ge=1, le=10)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Weights(_Strict):
    elders_away_from_speakers: SettingWeight
    seniors_near_stage: SettingWeight
    balance_sides: SettingWeight
    similar_ages: SettingWeight


class Settings(_Strict):
    households_together: StrictBool
    enforce_gender_zones: StrictBool
    children_with_guardian: StrictBool
    accessible_near_entrance: StrictBool
    accessible_max_distance_m: Distance
    vip_near_stage: StrictBool
    vip_max_distance_m: Distance
    kids_table: StrictBool
    weights: Weights


class Rule(_Strict):
    id: Annotated[str, StringConstraints(pattern=r"^rule_[0-9a-f]{8}$")]
    kind: RuleKind
    strength: RuleStrength
    weight: RuleWeight
    guest_ids: list[GuestId]
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]

    @model_validator(mode="after")
    def _check_guests(self) -> Self:
        count = len(self.guest_ids)
        unique = len(set(self.guest_ids)) == count
        if self.kind == "together":
            ok = unique and TOGETHER_MIN_GUESTS <= count <= TOGETHER_MAX_GUESTS
        else:
            ok = unique and count == 2
        if not ok:
            raise ValueError(
                "Together rules need 2-20 different guests; apart rules need exactly 2 different guests."
            )
        return self


class ConstraintData(_Strict):
    version: Literal[1]
    settings: Settings
    zones: dict[ObjectId, Zone]
    rules: Annotated[list[Rule], Field(max_length=MAX_RULES)]

    @model_validator(mode="after")
    def _unique_rule_ids(self) -> Self:
        if len({rule.id for rule in self.rules}) != len(self.rules):
            raise ValueError("Rule ids must be unique.")
        return self


def zone_for_table(zones: dict[str, Zone], table_id: str) -> Zone:
    return zones.get(table_id, DEFAULT_ZONE)


class ValidateConstraintsRequest(_Strict):
    layout: HallLayout
    guests: Annotated[list[Guest], Field(max_length=MAX_GUESTS)]
    constraints: ConstraintData

    @model_validator(mode="after")
    def _unique_guest_ids(self) -> Self:
        if len({guest.id for guest in self.guests}) != len(self.guests):
            raise ValueError("Guest ids must be unique.")
        return self


class ConstraintIssue(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    severity: Literal["error", "warning"]
    message: str
    # camelCase on the wire to match the editor's ConstraintIssue type; omitted when absent.
    rule_id: str | None = Field(default=None, alias="ruleId")


class ConstraintValidationSummary(BaseModel):
    errors: int
    warnings: int


class ValidateConstraintsResponse(BaseModel):
    valid: bool
    summary: ConstraintValidationSummary
    issues: list[ConstraintIssue]