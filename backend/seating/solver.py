"""CP-SAT model for the guest seating problem (every guest is always seated).

Model
-----
``x[g][s]`` is a Boolean: guest ``g`` sits at seat object ``s`` (a table or a sofa).

Always hard (physical):
  * every guest sits at exactly one seat object (when total capacity >= guest count)
  * a seat object never holds more guests than its capacity

Relaxable "hard" rules (Tier 2). They are NOT forbidden. Breaking one costs a large penalty, so the solver
breaks them only when that is the price of seating everyone, and it breaks the lowest-priority ones first:

    must apart            (highest priority)
    gender zones
    must together
    households together
    sofas for seniors only (lowest priority)

Preferences (Tier 1): proximity rewards, side balance, similar ages and prefer together/apart. Their total
stays far below one Tier-2 penalty, so a preference never wins against a hard rule.

The reported ``score`` is the Tier-1 (soft) score only. Tier-2 penalties are reported through
``broken_constraints`` instead, so the score stays readable. Violations are found by inspecting the final
assignment, not the penalty variables, so the list is always accurate.
"""
from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from ortools.sat.python import cp_model

from .geometry import min_distance, object_geometry

# ---- Tier 1: soft scoring units ---------------------------------------------------------------------
SCALE = 100              # proximity: weight * SCALE * closeness(0..1) per guest
VIP_WEIGHT = 10
CHIEF_GUEST_WEIGHT = 15
ACCESS_WEIGHT = 10
BALANCE_UNIT = 50        # penalty per unit of |bride - groom| at a seat object, times weight
AGE_UNIT = 40            # penalty per distinct age band at a seat object, times weight
PREF_UNIT = 60           # per co-seated member (together) / co-seated pair (apart), times rule weight

# ---- Tier 2: penalty per violation unit, ordered by priority (higher = broken last) ------------------
# Keep BASE far above the largest realistic soft total so a preference can never beat a hard rule.
BASE = 100_000_000
PEN_SOFA = 1 * BASE        # per non-senior guest on a sofa
PEN_HOUSEHOLD = 2 * BASE   # per household member separated from the household's main table
PEN_TOGETHER = 4 * BASE    # per must-together member separated from the rule's main table
PEN_ZONE = 8 * BASE        # per guest in a gender zone that excludes them
PEN_APART = 16 * BASE      # per must-apart pair sharing a seat object


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

    def respond(
        status: str,
        placed: dict[str, tuple[str, int]] | None = None,
        score: int = 0,
        broken: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        placed = placed or {}
        return {
            "status": status,
            "assignments": [
                {"guest_id": g["id"], "table_id": placed[g["id"]][0], "seat_index": placed[g["id"]][1]}
                for g in guests if g["id"] in placed
            ],
            "unassigned_guests": [g["id"] for g in guests if g["id"] not in placed],
            "broken_constraints": broken or [],
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
    total_capacity = sum(s.capacity for s in seats)
    if not seats:
        messages.append("The hall has no seats (tables or sofas with capacity).")
        return respond("INFEASIBLE")
    if total_capacity < n:
        # The only infeasible case: not enough physical seats.
        messages.append(f"The hall has {total_capacity} seats for {n} guests.")
        return respond("INFEASIBLE")

    index = {g["id"]: i for i, g in enumerate(guests)}
    S = range(len(seats))
    G = range(n)

    def known(ids: list[str]) -> list[int]:
        return sorted({index[i] for i in ids if i in index})

    for r in rules:
        unknown = [i for i in r["guest_ids"] if i not in index]
        if unknown:
            messages.append(f"Rule {r['id']} references unknown guests {unknown}; they were ignored.")

    # ---- model: variables and physical constraints ------------------------------------------------------
    model = cp_model.CpModel()
    x = [[model.NewBoolVar(f"x_{g}_{s}") for s in S] for g in G]

    for g in G:                                   # every guest gets exactly one seat object
        model.AddExactlyOne(x[g])
    for s in S:                                   # capacity
        model.Add(sum(x[g][s] for g in G) <= seats[s].capacity)

    # Objective pieces. `soft_*` feed the reported score; `hard_*` hold the Tier-2 penalties.
    soft_x: dict[tuple[int, int], int] = defaultdict(int)
    hard_x: dict[tuple[int, int], int] = defaultdict(int)
    soft_terms: list[tuple[cp_model.IntVar, int]] = []
    hard_terms: list[tuple[cp_model.IntVar, int]] = []

    # ---- Tier 2: relaxable hard constraints -------------------------------------------------------------
    # Sofas for seniors only: penalty on each non-senior x[g, sofa].
    if settings["sofas_for_seniors_only"]:
        for g in G:
            if guests[g]["age_band"] != "senior":
                for s in S:
                    if seats[s].kind == "sofa":
                        hard_x[g, s] -= PEN_SOFA

    # Gender zones: penalty on x[g, s] when the seat's zone excludes the guest.
    def zone_blocks(zone: str, gender: str) -> bool:
        return (zone == "men" and gender == "female") or (zone == "women" and gender == "male")

    if settings["enforce_gender_zones"]:
        for s in S:
            zone = zones.get(seats[s].id, "mixed")
            for g in G:
                if zone_blocks(zone, guests[g]["gender"]):
                    hard_x[g, s] -= PEN_ZONE

    def together_vars(tag: str, ids: list[int]) -> tuple[list[cp_model.IntVar], list[cp_model.IntVar]]:
        """m[s] = number of `ids` at the group's main seat object (dom[s] marks that main seat).

        Maximising sum(m) minimises the members who are separated from the main seat object.
        """
        k = len(ids)
        ms, doms = [], []
        for s in S:
            m = model.NewIntVar(0, min(k, seats[s].capacity), f"m_{tag}_{s}")
            dom = model.NewBoolVar(f"dom_{tag}_{s}")
            model.Add(m <= sum(x[i][s] for i in ids))
            model.Add(m <= k * dom)
            ms.append(m)
            doms.append(dom)
        model.AddAtMostOne(doms)
        return ms, doms

    # Households together: penalty per member separated from the household's main table.
    if settings["households_together"]:
        by_household: dict[str, list[int]] = defaultdict(list)
        for g in G:
            h = guests[g]["household"].strip()
            if h:
                by_household[h].append(g)
        for h, ids in by_household.items():
            if len(ids) >= 2:
                ms, _ = together_vars(f"hh{len(hard_terms)}", ids)
                hard_terms += [(m, PEN_HOUSEHOLD) for m in ms]

    # Must-together rules: same, with a higher penalty.
    for r in rules:
        ids = known(r["guest_ids"])
        if r["kind"] == "together" and r["strength"] == "must" and len(ids) >= 2:
            ms, _ = together_vars(f"mt_{r['id']}", ids)
            hard_terms += [(m, PEN_TOGETHER) for m in ms]

    # Must-apart rules: one violation Boolean per pair; it must be 1 if both share any seat object.
    for r in rules:
        ids = known(r["guest_ids"])
        if r["kind"] == "apart" and r["strength"] == "must" and len(ids) == 2:
            a, b = ids
            v = model.NewBoolVar(f"viol_apart_{r['id']}")
            for s in S:
                model.Add(x[a][s] + x[b][s] <= 1 + v)
            hard_terms.append((v, -PEN_APART))

    # ---- Tier 1: soft preferences -----------------------------------------------------------------------
    def reward_guests(guest_ids: list[int], weight: float, close: list[float]) -> None:
        if weight <= 0:
            return
        for g in guest_ids:
            for s in S:
                soft_x[g, s] += round(weight * SCALE * close[s])

    stage_d = [min_distance(seat.geom, stages) for seat in seats] if stages else []
    door_d = [min_distance(seat.geom, openings) for seat in seats] if openings else []

    vips = [(g, guests[g]["vip"]) for g in G if guests[g]["vip"] != "none"]
    mobile = [g for g in G if guests[g]["mobility"] != "none"]
    seniors = [g for g in G if guests[g]["age_band"] == "senior"]

    if settings["vip_near_stage"] and vips:                          # VIP proximity
        if stages:
            close = _closeness(stage_d, settings["vip_max_distance_m"])
            reward_guests([g for g, v in vips if v == "vip"], VIP_WEIGHT, close)
            reward_guests([g for g, v in vips if v == "chief_guest"], CHIEF_GUEST_WEIGHT, close)
        else:
            messages.append("VIP proximity skipped: the hall has no stage.")
    if settings["accessible_near_entrance"] and mobile:              # accessibility proximity
        if openings:
            reward_guests(mobile, ACCESS_WEIGHT, _closeness(door_d, settings["accessible_max_distance_m"]))
        else:
            messages.append("Accessibility proximity skipped: the hall has no entrance or exit.")
    if weights["elders_near_exits"] > 0 and seniors and openings:    # elders near exits
        reward_guests(seniors, weights["elders_near_exits"], _closeness(door_d, None))
    if weights["seniors_near_stage"] > 0 and seniors and stages:     # seniors near stage
        reward_guests(seniors, weights["seniors_near_stage"], _closeness(stage_d, None))

    # Balance sides: minimise |bride - groom| at each seat object.
    w = weights["balance_sides"]
    sides = [g["side"] for g in guests]
    if w > 0 and "bride" in sides and "groom" in sides:
        brides = [g for g in G if sides[g] == "bride"]
        grooms = [g for g in G if sides[g] == "groom"]
        for s in S:
            diff = model.NewIntVar(0, seats[s].capacity, f"imbalance_{s}")
            b = sum(x[g][s] for g in brides)
            gm = sum(x[g][s] for g in grooms)
            model.Add(diff >= b - gm)
            model.Add(diff >= gm - b)
            soft_terms.append((diff, -w * BALANCE_UNIT))

    # Similar ages: minimise distinct age bands per seat object.
    w = weights["similar_ages"]
    if w > 0 and len({g["age_band"] for g in guests}) > 1:
        present: dict[tuple[int, str], cp_model.IntVar] = {}
        for g in G:
            band = guests[g]["age_band"]
            for s in S:
                p = present.get((s, band))
                if p is None:
                    p = present[s, band] = model.NewBoolVar(f"band_{s}_{band}")
                    soft_terms.append((p, -w * AGE_UNIT))
                model.Add(p >= x[g][s])

    # Prefer together / apart.
    for r in rules:
        if r["strength"] != "prefer":
            continue
        ids = known(r["guest_ids"])
        u = r["weight"] * PREF_UNIT
        if r["kind"] == "together" and len(ids) >= 2:
            ms, doms = together_vars(f"pt_{r['id']}", ids)
            soft_terms += [(m, u) for m in ms]       # +u per member at the shared table...
            soft_terms += [(d, -u) for d in doms]    # ...minus one, so the first member earns nothing
        elif r["kind"] == "apart" and len(ids) == 2:
            a, b = ids
            v = model.NewBoolVar(f"viol_papart_{r['id']}")
            for s in S:
                model.Add(x[a][s] + x[b][s] <= 1 + v)
            soft_terms.append((v, -u))

    # ---- objective ----------------------------------------------------------------------------------------
    obj_vars: list[cp_model.IntVar] = []
    obj_coefs: list[int] = []
    for g in G:
        for s in S:
            c = soft_x.get((g, s), 0) + hard_x.get((g, s), 0)
            if c:
                obj_vars.append(x[g][s])
                obj_coefs.append(c)
    for var, c in soft_terms + hard_terms:
        obj_vars.append(var)
        obj_coefs.append(c)
    model.Maximize(cp_model.LinearExpr.WeightedSum(obj_vars, obj_coefs))

    # ---- solve ------------------------------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(opts["time_limit_seconds"])
    solver.parameters.num_workers = int(opts["num_workers"])
    solver.parameters.random_seed = 1
    status = solver.Solve(model)

    if status == cp_model.INFEASIBLE:  # should not happen: seats >= guests and only soft penalties remain
        messages.append("Unexpected: the model is infeasible although the hall has enough seats.")
        return respond("INFEASIBLE")
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        messages.append("No solution found within the time limit.")
        return respond("UNKNOWN")

    seat_of = [next(s for s in S if solver.BooleanValue(x[g][s])) for g in G]
    at_seat: dict[int, list[int]] = defaultdict(list)
    for g in G:
        at_seat[seat_of[g]].append(g)
    placed = {
        guests[g]["id"]: (seats[s].id, pos)
        for s, members in at_seat.items()
        for pos, g in enumerate(members)
    }

    # Clean score: soft terms only (no Tier-2 penalties).
    score = sum(soft_x.get((g, seat_of[g]), 0) for g in G)
    score += sum(c * solver.Value(v) for v, c in soft_terms)

    broken = _find_broken(guests, seats, seat_of, rules, settings, zones, known, stage_d, door_d)
    return respond("OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE", placed, int(score), broken)


# ---- broken-constraint report ------------------------------------------------------------------------------
def _find_broken(
    guests: list[dict[str, Any]],
    seats: list[Seat],
    seat_of: list[int],
    rules: list[dict[str, Any]],
    settings: dict[str, Any],
    zones: dict[str, str],
    known: Any,
    stage_d: list[float],
    door_d: list[float],
) -> list[dict[str, Any]]:
    """Inspect the final seating and list every rule it breaks (hard ones first)."""
    out: list[dict[str, Any]] = []

    def entry(kind: str, code: str, message: str, gids: list[int], sids: list[int], rule_id: str | None = None):
        prefix = "Broken constraint" if kind == "hard" else "Broken soft preference"
        item: dict[str, Any] = {
            "type": kind,
            "code": code,
            "message": f"{prefix}: {message}",
            "guest_ids": [guests[g]["id"] for g in gids],
            "seat_ids": sorted({seats[s].id for s in sids}),
        }
        if rule_id:
            item["rule_id"] = rule_id
        out.append(item)

    def names(ids: list[int]) -> str:
        return ", ".join(f"'{guests[g]['name']}'" for g in ids)

    # Must apart
    for r in rules:
        ids = known(r["guest_ids"])
        if r["kind"] == "apart" and r["strength"] == "must" and len(ids) == 2 and seat_of[ids[0]] == seat_of[ids[1]]:
            entry("hard", "must_apart",
                  f"'Sit apart' rule {r['id']} - {names(ids)} were seated together at '{seats[seat_of[ids[0]]].id}'.",
                  ids, [seat_of[ids[0]]], r["id"])

    # Gender zones
    if settings["enforce_gender_zones"]:
        for g, s in enumerate(seat_of):
            zone = zones.get(seats[s].id, "mixed")
            gender = guests[g]["gender"]
            if (zone == "men" and gender == "female") or (zone == "women" and gender == "male"):
                entry("hard", "enforce_gender_zones",
                      f"Gender zones - {gender} guest '{guests[g]['name']}' was seated at '{seats[s].id}' ({zone} zone).",
                      [g], [s])

    # Must together
    for r in rules:
        ids = known(r["guest_ids"])
        if r["kind"] == "together" and r["strength"] == "must" and len(ids) >= 2:
            used = {seat_of[g] for g in ids}
            if len(used) > 1:
                entry("hard", "must_together",
                      f"'Sit together' rule {r['id']} - {names(ids)} were split across {len(used)} seats "
                      f"({', '.join(sorted(seats[s].id for s in used))}).", ids, list(used), r["id"])

    # Households
    if settings["households_together"]:
        by_household: dict[str, list[int]] = defaultdict(list)
        for g, guest in enumerate(guests):
            h = guest["household"].strip()
            if h:
                by_household[h].append(g)
        for h, ids in by_household.items():
            used = {seat_of[g] for g in ids}
            if len(ids) >= 2 and len(used) > 1:
                entry("hard", "households_together",
                      f"Households together - household '{h}' ({names(ids)}) was split across {len(used)} seats "
                      f"({', '.join(sorted(seats[s].id for s in used))}).", ids, list(used))

    # Sofas for seniors only
    if settings["sofas_for_seniors_only"]:
        for g, s in enumerate(seat_of):
            if seats[s].kind == "sofa" and guests[g]["age_band"] != "senior":
                entry("hard", "sofas_for_seniors_only",
                      f"Sofas for seniors only - non-senior guest '{guests[g]['name']}' was seated on '{seats[s].id}'.",
                      [g], [s])

    # Soft: prefer rules
    for r in rules:
        if r["strength"] != "prefer":
            continue
        ids = known(r["guest_ids"])
        used = {seat_of[g] for g in ids}
        if r["kind"] == "together" and len(ids) >= 2 and len(used) > 1:
            entry("soft", "prefer_together",
                  f"'Sit together' preference {r['id']} - {names(ids)} were not all seated together.",
                  ids, list(used), r["id"])
        elif r["kind"] == "apart" and len(ids) == 2 and seat_of[ids[0]] == seat_of[ids[1]]:
            entry("soft", "prefer_apart",
                  f"'Sit apart' preference {r['id']} - {names(ids)} were seated together at '{seats[seat_of[ids[0]]].id}'.",
                  ids, [seat_of[ids[0]]], r["id"])

    # Soft: proximity limits from the settings
    if settings["vip_near_stage"] and stage_d:
        for g, guest in enumerate(guests):
            if guest["vip"] != "none" and stage_d[seat_of[g]] > settings["vip_max_distance_m"]:
                entry("soft", "vip_near_stage",
                      f"VIP near stage - '{guest['name']}' is {stage_d[seat_of[g]]:.1f} m from the stage "
                      f"(limit {settings['vip_max_distance_m']:g} m).", [g], [seat_of[g]])
    if settings["accessible_near_entrance"] and door_d:
        for g, guest in enumerate(guests):
            if guest["mobility"] != "none" and door_d[seat_of[g]] > settings["accessible_max_distance_m"]:
                entry("soft", "accessible_near_entrance",
                      f"Accessible near entrance - '{guest['name']}' is {door_d[seat_of[g]]:.1f} m from an entrance "
                      f"(limit {settings['accessible_max_distance_m']:g} m).", [g], [seat_of[g]])
    return out