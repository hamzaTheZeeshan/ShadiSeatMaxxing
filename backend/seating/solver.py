"""CP-SAT model for the guest seating problem.

Model
-----
Guests that are forced to share a table (same household, or in a must-together rule) are merged into
*groups* with union-find. One Boolean ``y[group, seat]`` says which seat object (table or sofa) the whole
group sits at; every guest's ``x[g, t]`` is the ``y`` of their group. This enforces households/must-together
without extra equality constraints and keeps the model small.

Objective = ASSIGN_BONUS * seated guests + soft score. ASSIGN_BONUS dominates, so guests are seated whenever
the hard constraints allow it. The reported ``score`` is the soft score only (bonus removed).
"""
from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from ortools.sat.python import cp_model

from .geometry import min_distance, object_geometry

ASSIGN_BONUS = 100_000   # per seated guest
SCALE = 100              # proximity: weight * SCALE * closeness(0..1) per guest
VIP_WEIGHT = 10
CHIEF_GUEST_WEIGHT = 15
ACCESS_WEIGHT = 10
BALANCE_UNIT = 50        # penalty per unit of |bride - groom| at a seat object, times weight
AGE_UNIT = 40            # penalty per distinct age band at a seat object, times weight
PREF_UNIT = 60           # per co-seated member (together) / per co-seated pair (apart), times rule weight


@dataclass
class Seat:
    id: str
    kind: str  # "table" | "sofa"
    capacity: int
    geom: Any


def _closeness(dists: list[float], limit: float | None) -> list[float]:
    """1.0 at/below `limit` (default: the closest seat), decaying linearly to 0.0 at the farthest seat."""
    finite = [d for d in dists if math.isfinite(d)]
    if not finite:
        return [0.0] * len(dists)
    lo = min(finite) if limit is None else limit
    hi = max(finite)
    out = []
    for d in dists:
        if not math.isfinite(d):
            out.append(0.0)
        elif d <= lo or hi <= lo:
            out.append(1.0)
        else:
            out.append(max(0.0, 1.0 - (d - lo) / (hi - lo)))
    return out


def solve_seating(
    layout: dict[str, Any],
    guests: list[dict[str, Any]],
    constraints: dict[str, Any],
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    opts = {"time_limit_seconds": 30.0, "num_workers": 8, **(options or {})}
    settings = constraints["settings"]
    weights = settings["weights"]
    zones: dict[str, str] = constraints.get("zones") or {}
    rules = constraints.get("rules") or []
    messages: list[str] = []

    def respond(status: str, placed: dict[str, tuple[str, int]] | None = None, score: int = 0) -> dict[str, Any]:
        placed = placed or {}
        return {
            "status": status,
            "assignments": [
                {"guest_id": g["id"], "table_id": placed[g["id"]][0], "seat_index": placed[g["id"]][1]}
                for g in guests if g["id"] in placed
            ],
            "unassigned_guests": [g["id"] for g in guests if g["id"] not in placed],
            "score": score,
            "execution_time_ms": int((time.perf_counter() - t0) * 1000),
            "messages": messages,
        }

    # ---- hall objects -------------------------------------------------------------------------------
    seats: list[Seat] = []
    stages, openings = [], []
    for obj in layout["objects"]:
        t = obj["type"]
        if t == "wall":
            continue
        geom = object_geometry(obj)
        if t in ("table", "sofa"):
            if obj["capacity"] > 0:
                seats.append(Seat(obj["id"], t, obj["capacity"], geom))
        elif t == "stage":
            stages.append(geom)
        elif t in ("entrance", "exit"):
            openings.append(geom)

    n = len(guests)
    if n == 0:
        return respond("OPTIMAL")
    if not seats:
        messages.append("The hall has no seats (tables or sofas with capacity).")
        return respond("INFEASIBLE")

    index = {g["id"]: i for i, g in enumerate(guests)}
    S = range(len(seats))

    # ---- groups of guests that must share a seat object ----------------------------------------------
    parent = list(range(n))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    if settings["households_together"]:
        by_household: dict[str, list[int]] = defaultdict(list)
        for i, g in enumerate(guests):
            h = g["household"].strip()
            if h:
                by_household[h].append(i)
        for members in by_household.values():
            for m in members[1:]:
                union(members[0], m)

    def known(ids: list[str]) -> list[int]:
        return [index[i] for i in ids if i in index]

    for r in rules:
        unknown = [i for i in r["guest_ids"] if i not in index]
        if unknown:
            messages.append(f"Rule {r['id']} references unknown guests {unknown}; they were ignored.")
        if r["kind"] == "together" and r["strength"] == "must":
            ms = known(r["guest_ids"])
            for m in ms[1:]:
                union(ms[0], m)

    group_of = [find(i) for i in range(n)]
    roots = sorted(set(group_of))
    gid = {root: k for k, root in enumerate(roots)}
    K = range(len(roots))
    members: list[list[int]] = [[] for _ in roots]
    for i in range(n):
        members[gid[group_of[i]]].append(i)
    grp = [gid[group_of[i]] for i in range(n)]  # guest index -> group index

    # ---- hard-constraint filtering: where may each group sit? ------------------------------------------
    def guest_ok(g: dict[str, Any], seat: Seat) -> bool:
        if seat.kind == "sofa" and settings["sofas_for_seniors_only"] and g["age_band"] != "senior":
            return False
        if settings["enforce_gender_zones"]:
            zone = zones.get(seat.id, "mixed")
            if zone == "men" and g["gender"] == "female":
                return False
            if zone == "women" and g["gender"] == "male":
                return False
        return True

    allowed: list[list[int]] = [
        [s for s in S if all(guest_ok(guests[i], seats[s]) for i in members[k])] for k in K
    ]

    # Must-apart rules whose guests are forced into one group can never hold.
    must_apart: list[tuple[int, int]] = []
    for r in rules:
        if r["kind"] == "apart" and r["strength"] == "must":
            a, b = (index.get(i) for i in r["guest_ids"][:2])
            if a is None or b is None:
                continue
            if grp[a] == grp[b]:
                messages.append(
                    f"Rule {r['id']} keeps {guests[a]['name']} and {guests[b]['name']} apart, but "
                    "households or must-together rules force them to share a table."
                )
                return respond("INFEASIBLE")
            must_apart.append((grp[a], grp[b]))

    total_capacity = sum(s.capacity for s in seats)
    force_all = total_capacity >= n

    # ---- model ----------------------------------------------------------------------------------------
    model = cp_model.CpModel()
    y: dict[tuple[int, int], cp_model.IntVar] = {}
    for k in K:
        if force_all and not allowed[k]:
            messages.append(
                f"{guests[members[k][0]]['name']}'s group has no seat allowed by the gender-zone / sofa rules."
            )
            return respond("INFEASIBLE")
        for s in allowed[k]:
            y[k, s] = model.NewBoolVar(f"y_{k}_{s}")

    size = [len(m) for m in members]

    # 1. capacity
    for s in S:
        terms = [(size[k], y[k, s]) for k in K if (k, s) in y]
        if terms:
            model.Add(sum(c * v for c, v in terms) <= seats[s].capacity)

    # 2. single assignment
    for k in K:
        row = [y[k, s] for s in allowed[k]]
        if row:
            if force_all:
                model.AddExactlyOne(row)
            else:
                model.AddAtMostOne(row)

    # 6. must apart
    for ka, kb in must_apart:
        for s in S:
            if (ka, s) in y and (kb, s) in y:
                model.Add(y[ka, s] + y[kb, s] <= 1)

    # ---- objective ------------------------------------------------------------------------------------
    lin: dict[tuple[int, int], int] = defaultdict(int)  # coefficient on y[k, s]
    extra_vars: list[cp_model.IntVar] = []
    extra_coefs: list[int] = []

    def add_extra(var: cp_model.IntVar, coef: int) -> None:
        extra_vars.append(var)
        extra_coefs.append(coef)

    def reward_guests(guest_ids: list[int], weight: float, close: list[float]) -> None:
        if weight <= 0:
            return
        for i in guest_ids:
            k = grp[i]
            for s in allowed[k]:
                lin[k, s] += round(weight * SCALE * close[s])

    if stages:
        stage_d = [min_distance(seat.geom, stages) for seat in seats]
    if openings:
        door_d = [min_distance(seat.geom, openings) for seat in seats]

    vips = [(i, g["vip"]) for i, g in enumerate(guests) if g["vip"] != "none"]
    mobile = [i for i, g in enumerate(guests) if g["mobility"] != "none"]
    seniors = [i for i, g in enumerate(guests) if g["age_band"] == "senior"]

    # 1. VIP proximity
    if settings["vip_near_stage"] and vips:
        if stages:
            close = _closeness(stage_d, settings["vip_max_distance_m"])
            reward_guests([i for i, v in vips if v == "vip"], VIP_WEIGHT, close)
            reward_guests([i for i, v in vips if v == "chief_guest"], CHIEF_GUEST_WEIGHT, close)
        else:
            messages.append("VIP proximity skipped: the hall has no stage.")
    # 2. Accessibility proximity
    if settings["accessible_near_entrance"] and mobile:
        if openings:
            close = _closeness(door_d, settings["accessible_max_distance_m"])
            reward_guests(mobile, ACCESS_WEIGHT, close)
        else:
            messages.append("Accessibility proximity skipped: the hall has no entrance or exit.")
    # 3. Elders near exits
    if weights["elders_near_exits"] > 0 and seniors and openings:
        reward_guests(seniors, weights["elders_near_exits"], _closeness(door_d, None))
    # 4. Seniors near stage
    if weights["seniors_near_stage"] > 0 and seniors and stages:
        reward_guests(seniors, weights["seniors_near_stage"], _closeness(stage_d, None))

    # 5. Balance bride / groom sides: minimise |bride - groom| at each seat object
    w = weights["balance_sides"]
    if w > 0:
        sides = [g["side"] for g in guests]
        if "bride" in sides and "groom" in sides:
            for s in S:
                bride, groom = [], []
                for k in K:
                    if (k, s) not in y:
                        continue
                    b = sum(1 for i in members[k] if sides[i] == "bride")
                    gm = sum(1 for i in members[k] if sides[i] == "groom")
                    if b:
                        bride.append(b * y[k, s])
                    if gm:
                        groom.append(gm * y[k, s])
                if not bride and not groom:
                    continue
                diff = model.NewIntVar(0, seats[s].capacity, f"imbalance_{s}")
                model.Add(diff >= sum(bride) - sum(groom))
                model.Add(diff >= sum(groom) - sum(bride))
                add_extra(diff, -w * BALANCE_UNIT)

    # 6. Similar ages: minimise distinct age bands per seat object
    w = weights["similar_ages"]
    if w > 0 and len({g["age_band"] for g in guests}) > 1:
        bands_of = [sorted({guests[i]["age_band"] for i in members[k]}) for k in K]
        present: dict[tuple[int, str], cp_model.IntVar] = {}
        for k in K:
            for s in allowed[k]:
                for band in bands_of[k]:
                    p = present.get((s, band))
                    if p is None:
                        p = present[s, band] = model.NewBoolVar(f"band_{s}_{band}")
                        add_extra(p, -w * AGE_UNIT)
                    model.Add(p >= y[k, s])

    # 7. Prefer together / apart
    for r in rules:
        if r["strength"] != "prefer":
            continue
        ids = known(r["guest_ids"])
        u = r["weight"] * PREF_UNIT
        if r["kind"] == "together" and len(ids) >= 2:
            dom_vars = []
            for s in S:
                at_s = [y[grp[i], s] for i in ids if (grp[i], s) in y]
                if not at_s:
                    continue
                dom = model.NewBoolVar(f"dom_{r['id']}_{s}")
                m = model.NewIntVar(0, len(ids), f"m_{r['id']}_{s}")
                model.Add(m <= sum(at_s))
                model.Add(m <= len(ids) * dom)
                dom_vars.append(dom)
                add_extra(m, u)    # +u per member at the shared table...
                add_extra(dom, -u)  # ...minus one, so the first member earns nothing
            if dom_vars:
                model.AddAtMostOne(dom_vars)
        elif r["kind"] == "apart" and len(ids) == 2:
            a, b = ids
            if grp[a] == grp[b]:
                messages.append(f"Rule {r['id']} (prefer apart) cannot be met: both guests are in one forced group.")
                continue
            for s in S:
                if (grp[a], s) in y and (grp[b], s) in y:
                    z = model.NewBoolVar(f"apart_{r['id']}_{s}")
                    model.Add(z >= y[grp[a], s] + y[grp[b], s] - 1)
                    add_extra(z, -u)

    obj_vars: list[cp_model.IntVar] = []
    obj_coefs: list[int] = []
    for (k, s), v in y.items():
        obj_vars.append(v)
        obj_coefs.append(ASSIGN_BONUS * size[k] + lin.get((k, s), 0))
    obj_vars += extra_vars
    obj_coefs += extra_coefs
    model.Maximize(cp_model.LinearExpr.WeightedSum(obj_vars, obj_coefs))

    # ---- solve ----------------------------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(opts["time_limit_seconds"])
    solver.parameters.num_workers = int(opts["num_workers"])
    solver.parameters.random_seed = 1
    status = solver.Solve(model)

    if status == cp_model.INFEASIBLE:
        messages.append("No seating satisfies all hard constraints.")
        return respond("INFEASIBLE")
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        messages.append("No solution found within the time limit.")
        return respond("UNKNOWN")

    at_seat: dict[int, list[int]] = defaultdict(list)
    for (k, s), v in y.items():
        if solver.BooleanValue(v):
            at_seat[s].extend(members[k])
    placed: dict[str, tuple[str, int]] = {}
    for s, idxs in at_seat.items():
        for pos, i in enumerate(sorted(idxs)):
            placed[guests[i]["id"]] = (seats[s].id, pos)

    score = int(round(solver.ObjectiveValue())) - ASSIGN_BONUS * len(placed)
    return respond("OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE", placed, score)