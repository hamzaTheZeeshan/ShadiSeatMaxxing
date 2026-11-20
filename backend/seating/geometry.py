"""Python port of the frontend geometry helpers (objectPolygon / polygonDistance), built on shapely."""
from __future__ import annotations

import math
from typing import Any, Iterable

from shapely.geometry import MultiPoint, Point
from shapely.geometry.base import BaseGeometry

# Thickness of an entrance/exit marker (OPENING_THICKNESS in defaults.ts; value not supplied, adjust to match).
OPENING_THICKNESS = 0.3
ROUND_QUAD_SEGS = 8  # 8 per quarter = 32 segments, same as the frontend.


def _rotated_rect(cx: float, cy: float, w: float, h: float, rotation_deg: float) -> BaseGeometry:
    rad = math.radians(rotation_deg)
    cos, sin = math.cos(rad), math.sin(rad)
    hw, hh = w / 2, h / 2
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    # Clockwise on screen (y down): x' = x cos - y sin, y' = x sin + y cos.
    pts = [(cx + x * cos - y * sin, cy + x * sin + y * cos) for x, y in corners]
    return MultiPoint(pts).convex_hull  # robust even for degenerate (zero-width) rectangles


def object_geometry(obj: dict[str, Any]) -> BaseGeometry:
    t = obj["type"]
    x, y, rot = obj["x"], obj["y"], obj.get("rotation", 0.0)
    if t == "table" and obj.get("shape") == "round":
        return Point(x, y).buffer(obj["radius"], quad_segs=ROUND_QUAD_SEGS)
    if t in ("entrance", "exit"):
        return _rotated_rect(x, y, obj["width"], OPENING_THICKNESS, rot)
    return _rotated_rect(x, y, obj["width"], obj["height"], rot)


def min_distance(geom: BaseGeometry, targets: Iterable[BaseGeometry]) -> float:
    return min((geom.distance(t) for t in targets), default=math.inf)