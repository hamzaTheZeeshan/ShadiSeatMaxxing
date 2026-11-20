from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

MAX_GUESTS = 2000

GuestId = Annotated[str, StringConstraints(pattern=r"^guest_[0-9a-f]{8}$")]

Side = Literal["bride", "groom", "other"]
Gender = Literal["male", "female", "unspecified"]
AgeBand = Literal["infant", "child", "teen", "adult", "senior"]
Role = Literal[
    "couple",
    "parent",
    "grandparent",
    "sibling",
    "wedding_party",
    "relative",
    "friend",
    "colleague",
    "family_friend",
    "other",
]
VipLevel = Literal["none", "vip", "chief_guest"]
MobilityLevel = Literal["none", "wheelchair", "walker", "assistance"]
DietaryOption = Literal["none", "vegetarian", "allergy", "other"]


class Guest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: GuestId
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    household: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]
    side: Side
    gender: Gender
    age_band: AgeBand
    role: Role
    vip: VipLevel
    mobility: MobilityLevel
    dietary: DietaryOption
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
    guardian_id: GuestId | None = None