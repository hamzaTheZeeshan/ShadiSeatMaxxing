import logging
from dataclasses import dataclass
from typing import Literal

from app.algorithms.geometry.collision import (
    EPSILON,
    OPENING_THICKNESS,
    Box,
    Polygon,
    RectShape,
    RoundShape,
    Shape,
    boxes_within,
    bounds,
    polygon_distance,
    polygon_inside_rect,
    polygons_overlap,
    shape_polygon,
    table_footprint,
)
from app.schemas.layout import (
    AnyObject,
    DanceFloorObject,
    EntranceObject,
    ExitObject,
    HallLayout,
    RestrictedAreaObject,
    ServiceAreaObject,
    StageObject,
    TableObject,
)
from app.schemas.validation import (
    IssueCode,
    Severity,
    ValidateLayoutResponse,
    ValidationIssue,
    ValidationSummary,
)
from app.services.errors import InvalidLayoutError

logger = logging.getLogger(__name__)

# Same thresholds as the editor (client utils/validation.ts).
MIN_AISLE = 0.6  # metres between two table footprints
ENTRANCE_CLEARANCE = 1.5  # metres between a table footprint and an entrance/exit

Kind = Literal["table", "stage", "dance_floor", "restricted_area", "service_area", "opening"]

_NAMES: dict[str, str] = {
    "stage": "Stage",
    "dance_floor": "Dance Floor",
    "restricted_area": "Restricted Area",
    "service_area": "Service Area",
    "entrance": "Entrance",
    "exit": "Exit",
}


@dataclass(frozen=True)
class _Entry:
    object_id: str
    kind: Kind
    label: str
    x: float
    y: float
    body: Polygon
    # Table body plus chair ring; equals body for every other kind.
    footprint: Polygon
    body_box: Box
    footprint_box: Box


def _shape_of(obj: AnyObject) -> Shape:
    if isinstance(obj, TableObject):
        if obj.shape == "round":
            if obj.radius is None:
                raise InvalidLayoutError("round table is missing radius")
            return RoundShape(float(obj.x), float(obj.y), float(obj.radius))
        if obj.width is None or obj.height is None:
            raise InvalidLayoutError("rectangular table is missing width or height")
        return RectShape(float(obj.x), float(obj.y), float(obj.width), float(obj.height), float(obj.rotation))
    if isinstance(obj, (EntranceObject, ExitObject)):
        return RectShape(float(obj.x), float(obj.y), float(obj.width), OPENING_THICKNESS, float(obj.rotation))
    return RectShape(float(obj.x), float(obj.y), float(obj.width), float(obj.height), float(obj.rotation))


def _kind_of(obj: AnyObject) -> Kind:
    if isinstance(obj, TableObject):
        return "table"
    if isinstance(obj, StageObject):
        return "stage"
    if isinstance(obj, DanceFloorObject):
        return "dance_floor"
    if isinstance(obj, RestrictedAreaObject):
        return "restricted_area"
    if isinstance(obj, ServiceAreaObject):
        return "service_area"
    return "opening"


def _build_entries(objects: list[AnyObject]) -> list[_Entry]:
    entries: list[_Entry] = []
    table_number = 0
    for obj in objects:
        kind = _kind_of(obj)
        if isinstance(obj, TableObject):
            table_number += 1
            label = f"T{table_number}"
        else:
            label = _NAMES[obj.type]
        shape = _shape_of(obj)
        body = shape_polygon(shape)
        footprint = table_footprint(shape) if kind == "table" else body
        entries.append(
            _Entry(
                object_id=obj.id,
                kind=kind,
                label=label,
                x=float(obj.x),
                y=float(obj.y),
                body=body,
                footprint=footprint,
                body_box=bounds(body),
                footprint_box=bounds(footprint),
            )
        )
    return entries


def _issue(code: IssueCode, severity: Severity, object_ids: list[str], message: str) -> ValidationIssue:
    return ValidationIssue(
        id=f"{code}:{'|'.join(sorted(object_ids))}",
        code=code,
        severity=severity,
        objectIds=object_ids,
        message=message,
    )


def _non_table_overlaps(a: Kind, b: Kind) -> bool:
    if a == "stage":
        return b in ("dance_floor", "service_area")
    if a in ("dance_floor", "service_area"):
        return b == "stage"
    return False


def _check_table_pair(table: _Entry, other: _Entry, out: list[ValidationIssue]) -> None:
    ids = [table.object_id, other.object_id]
    if other.kind == "table":
        if not boxes_within(table.footprint_box, other.footprint_box, MIN_AISLE):
            return
        if polygons_overlap(table.footprint, other.footprint):
            out.append(_issue("overlap", "error", ids, f"{table.label} and {other.label} overlap (chairs included)."))
            return
        d = polygon_distance(table.footprint, other.footprint)
        if d < MIN_AISLE - EPSILON:
            out.append(
                _issue(
                    "narrow_aisle",
                    "warning",
                    ids,
                    f"Aisle between {table.label} and {other.label} is only {d:.2f} m (minimum {MIN_AISLE} m).",
                )
            )
        return
    if other.kind in ("stage", "dance_floor", "service_area"):
        if boxes_within(table.body_box, other.body_box, 0.0) and polygons_overlap(table.body, other.body):
            out.append(_issue("overlap", "error", ids, f"{table.label} overlaps {other.label}."))
        return
    if other.kind == "restricted_area":
        if boxes_within(table.body_box, other.body_box, 0.0) and polygons_overlap(table.body, other.body):
            out.append(_issue("table_in_restricted", "error", ids, f"{table.label} overlaps a Restricted Area."))
        return
    # other.kind == "opening"
    if not boxes_within(table.footprint_box, other.body_box, ENTRANCE_CLEARANCE):
        return
    if polygons_overlap(table.footprint, other.body):
        out.append(_issue("table_blocks_opening", "error", ids, f"{table.label} blocks the {other.label}."))
        return
    d = polygon_distance(table.footprint, other.body)
    if d < ENTRANCE_CLEARANCE - EPSILON:
        out.append(
            _issue(
                "near_opening",
                "warning",
                ids,
                f"{table.label} is only {d:.2f} m from the {other.label} (clearance {ENTRANCE_CLEARANCE} m).",
            )
        )


def _check_pair(a: _Entry, b: _Entry, out: list[ValidationIssue]) -> None:
    swap = a.kind != "table" and b.kind == "table"
    first, second = (b, a) if swap else (a, b)
    if first.kind == "table":
        _check_table_pair(first, second, out)
        return
    if (
        _non_table_overlaps(first.kind, second.kind)
        and boxes_within(first.body_box, second.body_box, 0.0)
        and polygons_overlap(first.body, second.body)
    ):
        out.append(
            _issue("overlap", "error", [first.object_id, second.object_id], f"{first.label} overlaps {second.label}.")
        )


def _sort_key(issue: ValidationIssue) -> tuple[int, str]:
    return (0 if issue.severity == "error" else 1, issue.id)


def validate_layout(layout: HallLayout) -> ValidateLayoutResponse:
    width = float(layout.hall.width)
    height = float(layout.hall.height)
    entries = _build_entries(list(layout.objects))
    issues: list[ValidationIssue] = []

    for e in entries:
        if e.kind == "opening":
            inside = -EPSILON <= e.x <= width + EPSILON and -EPSILON <= e.y <= height + EPSILON
            if not inside:
                issues.append(_issue("out_of_bounds", "error", [e.object_id], f"{e.label} is outside the hall."))
            continue
        if not polygon_inside_rect(e.footprint, width, height):
            suffix = " (including chairs)" if e.kind == "table" else ""
            issues.append(
                _issue("out_of_bounds", "error", [e.object_id], f"{e.label}{suffix} extends outside the hall.")
            )

    for i, a in enumerate(entries):
        for b in entries[i + 1 :]:
            _check_pair(a, b, issues)

    issues.sort(key=_sort_key)
    errors = sum(1 for issue in issues if issue.severity == "error")
    warnings = len(issues) - errors
    # Counts only; never log the layout itself.
    logger.info("validate_layout objects=%d errors=%d warnings=%d", len(entries), errors, warnings)
    return ValidateLayoutResponse(
        valid=errors == 0,
        summary=ValidationSummary(errors=errors, warnings=warnings),
        issues=issues,
    )