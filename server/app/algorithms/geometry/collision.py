import math
from dataclasses import dataclass

CHAIR_RADIUS = 0.2
CHAIR_OFFSET = 0.25
OPENING_THICKNESS = 0.3
EPSILON = 1e-9
ROUND_SEGMENTS = 32

Vec = tuple[float, float]
# Convex polygon, world metres.
Polygon = list[Vec]
# (min_x, min_y, max_x, max_y)
Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class RoundShape:
    cx: float
    cy: float
    radius: float


@dataclass(frozen=True)
class RectShape:
    cx: float
    cy: float
    width: float
    height: float
    rotation: float  # degrees clockwise about the center


Shape = RoundShape | RectShape


def rotated_rect(cx: float, cy: float, width: float, height: float, rotation_deg: float) -> Polygon:
    rad = rotation_deg * math.pi / 180
    cos = math.cos(rad)
    sin = math.sin(rad)
    hw = width / 2
    hh = height / 2
    corners = ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))
    # Clockwise on screen (y down): x' = x cos - y sin, y' = x sin + y cos.
    return [(cx + x * cos - y * sin, cy + x * sin + y * cos) for x, y in corners]


def regular_polygon(cx: float, cy: float, radius: float, segments: int) -> Polygon:
    return [
        (
            cx + radius * math.cos(2 * math.pi * i / segments),
            cy + radius * math.sin(2 * math.pi * i / segments),
        )
        for i in range(segments)
    ]


def shape_polygon(shape: Shape) -> Polygon:
    if isinstance(shape, RoundShape):
        return regular_polygon(shape.cx, shape.cy, shape.radius, ROUND_SEGMENTS)
    return rotated_rect(shape.cx, shape.cy, shape.width, shape.height, shape.rotation)


def outset_polygon(shape: Shape, margin: float) -> Polygon:
    # Shape grown by `margin` on every side (used for the table + chair-ring footprint).
    if isinstance(shape, RoundShape):
        return regular_polygon(shape.cx, shape.cy, shape.radius + margin, ROUND_SEGMENTS)
    return rotated_rect(
        shape.cx, shape.cy, shape.width + 2 * margin, shape.height + 2 * margin, shape.rotation
    )


def table_footprint(shape: Shape) -> Polygon:
    return outset_polygon(shape, CHAIR_OFFSET + CHAIR_RADIUS)


def bounds(poly: Polygon) -> Box:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return (min(xs), min(ys), max(xs), max(ys))


def boxes_within(a: Box, b: Box, gap: float) -> bool:
    # False only when the boxes are separated by more than `gap` on some axis, which
    # guarantees the polygons inside are farther apart than `gap`.
    return not (
        a[0] > b[2] + gap or b[0] > a[2] + gap or a[1] > b[3] + gap or b[1] > a[3] + gap
    )


def _edge_axes(poly: Polygon) -> list[Vec]:
    axes: list[Vec] = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        ex = q[0] - p[0]
        ey = q[1] - p[1]
        length = math.hypot(ex, ey)
        if length == 0:
            continue
        axes.append((-ey / length, ex / length))
    return axes


def _project(poly: Polygon, axis: Vec) -> tuple[float, float]:
    values = [p[0] * axis[0] + p[1] * axis[1] for p in poly]
    return min(values), max(values)


def polygons_overlap(a: Polygon, b: Polygon) -> bool:
    # Separating axis theorem. Touching edges do NOT count as overlap.
    if len(a) < 3 or len(b) < 3:
        return False
    for axis in (*_edge_axes(a), *_edge_axes(b)):
        a_min, a_max = _project(a, axis)
        b_min, b_max = _project(b, axis)
        if a_max <= b_min + EPSILON or b_max <= a_min + EPSILON:
            return False
    return True


def _point_segment_distance(p: Vec, a: Vec, b: Vec) -> float:
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len_sq))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def _min_vertex_to_edges(points: Polygon, poly: Polygon) -> float:
    best = math.inf
    for p in points:
        for i, a in enumerate(poly):
            d = _point_segment_distance(p, a, poly[(i + 1) % len(poly)])
            if d < best:
                best = d
    return best


def polygon_distance(a: Polygon, b: Polygon) -> float:
    # Minimum distance between two convex polygons; 0 if they overlap.
    if polygons_overlap(a, b):
        return 0.0
    return min(_min_vertex_to_edges(a, b), _min_vertex_to_edges(b, a))


def polygon_inside_rect(poly: Polygon, width: float, height: float) -> bool:
    return all(
        -EPSILON <= x <= width + EPSILON and -EPSILON <= y <= height + EPSILON for x, y in poly
    )