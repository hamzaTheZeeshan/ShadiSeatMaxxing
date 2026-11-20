import logging
from collections import Counter

from app.algorithms.csp.diagnostics import find_conflicts
from app.algorithms.csp.model_builder import (
    ApartSpec,
    GuestSpec,
    ProblemSpec,
    SoftPairSpec,
    TableSpec,
    TogetherSpec,
)
from app.algorithms.csp.solver import solve_spec
from app.algorithms.csp.union_find import UnionFind
from app.core.config import settings as app_settings
from app.schemas.constraint import Zone, zone_for_table
from app.schemas.layout import TableObject
from app.schemas.seating import (
    Assignment,
    Notice,
    PenaltyEntry,
    SolveRequest,
    SolveResponse,
    SolveStatus,
)
from app.services.constraint_validation_service import summarize_layout, validate_constraints

logger = logging.getLogger(__name__)

MIN_TIME_LIMIT = 1.0
MAX_TIME_LIMIT = 60.0


def _notice(code: str, message: str, rule_ids: tuple[str, ...] = ()) -> Notice:
    return Notice(code=code, message=message, rule_ids=list(rule_ids))


def _sorted(notices: list[Notice]) -> list[Notice]:
    return sorted(notices, key=lambda n: (n.code, n.rule_ids, n.message))


def _response(
    status: SolveStatus,
    *,
    proven: bool = False,
    assignments: list[Assignment] | None = None,
    unassigned: list[str] | None = None,
    objective: float | None = None,
    penalties: list[PenaltyEntry] | None = None,
    warnings: list[Notice] | None = None,
    diagnostics: list[Notice] | None = None,
) -> SolveResponse:
    return SolveResponse(
        status=status,
        optimality_proven=proven,
        assignments=assignments or [],
        unassigned_guest_ids=unassigned or [],
        objective_value=objective,
        penalties=penalties or [],
        warnings=_sorted(warnings or []),
        diagnostics=_sorted(diagnostics or []),
    )


def _zone_allows(zone: Zone, gender: str) -> bool:
    if zone == "men":
        return gender == "male"
    if zone == "women":
        return gender == "female"
    return True


def _build_spec(request: SolveRequest, tables: list[TableObject]) -> tuple[ProblemSpec, list[Notice]]:
    data = request.constraints
    warnings: list[Notice] = []

    guests = tuple(
        GuestSpec(g.id, g.name, g.gender) for g in sorted(request.guests, key=lambda guest: guest.id)
    )
    table_specs = tuple(
        TableSpec(
            id=t.id,
            capacity=t.capacity,
            allows_male=_zone_allows(zone_for_table(data.zones, t.id), "male"),
            allows_female=_zone_allows(zone_for_table(data.zones, t.id), "female"),
        )
        for t in tables
    )

    together: list[TogetherSpec] = []
    apart: list[ApartSpec] = []
    soft: list[SoftPairSpec] = []
    for rule in sorted(data.rules, key=lambda r: r.id):
        ids = tuple(dict.fromkeys(rule.guest_ids))
        if rule.strength == "must":
            if rule.kind == "together":
                together.append(TogetherSpec(ids, rule.id))
            else:
                apart.append(ApartSpec(rule.id, ids[0], ids[1]))
        elif rule.kind == "apart":
            soft.append(SoftPairSpec(rule.id, ids[0], ids[1], rule.weight, False))
        elif len(ids) == 2:
            soft.append(SoftPairSpec(rule.id, ids[0], ids[1], rule.weight, True))
        else:
            warnings.append(
                _notice(
                    "NOT_IMPLEMENTED",
                    "Prefer-together rules with more than 2 guests are not implemented in the solver yet "
                    "and were ignored.",
                    (rule.id,),
                )
            )

    if data.settings.households_together:
        households: dict[str, list[str]] = {}
        for guest in request.guests:
            if guest.household != "":
                households.setdefault(guest.household, []).append(guest.id)
        for members in households.values():
            if len(members) >= 2:
                together.append(TogetherSpec(tuple(sorted(members)), None))

    s = data.settings
    skipped: list[str] = []
    if s.children_with_guardian:
        skipped.append("children_with_guardian")
    if s.accessible_near_entrance:
        skipped.append("accessible_near_entrance")
    if s.vip_near_stage:
        skipped.append("vip_near_stage")
    if s.kids_table:
        skipped.append("kids_table")
    if s.weights.elders_away_from_speakers > 0:
        skipped.append("weights.elders_away_from_speakers")
    if s.weights.seniors_near_stage > 0:
        skipped.append("weights.seniors_near_stage")
    if s.weights.balance_sides > 0:
        skipped.append("weights.balance_sides")
    if s.weights.similar_ages > 0:
        skipped.append("weights.similar_ages")
    for name in skipped:
        warnings.append(
            _notice("NOT_IMPLEMENTED", f"Setting '{name}' is not implemented in the solver yet and was ignored.")
        )

    spec = ProblemSpec(
        guests=guests,
        tables=table_specs,
        together=tuple(together),
        apart=tuple(apart),
        soft=tuple(soft),
        enforce_zones=s.enforce_gender_zones,
        locks=tuple((lock.guest_id, lock.table_object_id) for lock in request.locked_assignments),
    )
    return spec, warnings


def _precheck(spec: ProblemSpec) -> list[Notice]:
    notices: list[Notice] = []
    guest_ids = {g.id for g in spec.guests}
    capacity = {t.id: t.capacity for t in spec.tables}
    total = sum(capacity.values())

    if not spec.tables:
        notices.append(_notice("NO_TABLES", "The hall has no tables, so nobody can be seated."))
    elif total < len(spec.guests):
        notices.append(
            _notice(
                "INSUFFICIENT_CAPACITY",
                f"{len(spec.guests)} guests but only {total} seats.",
            )
        )

    counts = Counter(guest_id for guest_id, _ in spec.locks)
    for guest_id, count in sorted(counts.items()):
        if count > 1:
            notices.append(_notice("LOCK_DUPLICATE", f'Guest "{guest_id}" is locked more than once.'))

    valid: dict[str, str] = {}
    for guest_id, table_id in spec.locks:
        if guest_id not in guest_ids:
            notices.append(_notice("LOCK_UNKNOWN_GUEST", f'Locked guest "{guest_id}" does not exist.'))
        elif table_id not in capacity:
            notices.append(_notice("LOCK_UNKNOWN_TABLE", f'Locked table "{table_id}" is not in the hall.'))
        elif counts[guest_id] == 1:
            valid[guest_id] = table_id

    per_table = Counter(valid.values())
    for table_id, count in sorted(per_table.items()):
        if count > capacity[table_id]:
            notices.append(
                _notice(
                    "LOCK_OVER_CAPACITY",
                    f'{count} guests are locked to table "{table_id}", which seats {capacity[table_id]}.',
                )
            )

    # Locks that break a hard rule.
    uf = UnionFind()
    for together in spec.together:
        for guest_id in together.guest_ids:
            uf.union(together.guest_ids[0], guest_id)
    members_by_root: dict[str, list[str]] = {}
    for together in spec.together:
        for guest_id in together.guest_ids:
            root = uf.find(guest_id)
            if guest_id not in members_by_root.setdefault(root, []):
                members_by_root[root].append(guest_id)
    for root in sorted(members_by_root):
        members = members_by_root[root]
        locked_tables = {valid[m] for m in members if m in valid}
        if len(locked_tables) > 1:
            rule_ids = tuple(
                sorted(
                    {
                        t.rule_id
                        for t in spec.together
                        if t.rule_id is not None and uf.find(t.guest_ids[0]) == root
                    }
                )
            )
            notices.append(
                _notice(
                    "LOCK_VIOLATES_RULE",
                    "Guests who must sit together are locked to different tables.",
                    rule_ids,
                )
            )
    for apart in spec.apart:
        if apart.a in valid and apart.b in valid and valid[apart.a] == valid[apart.b]:
            notices.append(
                _notice(
                    "LOCK_VIOLATES_RULE",
                    "Two guests who must sit apart are locked to the same table.",
                    (apart.rule_id,),
                )
            )
    if spec.enforce_zones:
        tables = {t.id: t for t in spec.tables}
        gender = {g.id: g.gender for g in spec.guests}
        for guest_id, table_id in sorted(valid.items()):
            table = tables[table_id]
            if (gender[guest_id] == "male" and not table.allows_male) or (
                gender[guest_id] == "female" and not table.allows_female
            ):
                notices.append(
                    _notice(
                        "LOCK_VIOLATES_RULE",
                        f'Guest "{guest_id}" is locked to a table whose zone does not allow their gender.',
                    )
                )
    return notices


def solve(request: SolveRequest) -> SolveResponse:
    layout = summarize_layout(request.layout)
    issues = validate_constraints(request.constraints, request.guests, layout)
    errors = [issue for issue in issues if issue.severity == "error"]
    if errors:
        return _response(
            "MODEL_INVALID",
            diagnostics=[
                _notice(
                    "VALIDATION_ERROR",
                    issue.message,
                    (issue.rule_id,) if issue.rule_id is not None else (),
                )
                for issue in errors
            ],
        )

    tables = [obj for obj in request.layout.objects if isinstance(obj, TableObject)]
    spec, warnings = _build_spec(request, tables)

    requested = request.options.time_limit_seconds
    default_limit = float(app_settings.SOLVER_DEFAULT_TIME_LIMIT_SECONDS)
    limit = max(MIN_TIME_LIMIT, min(MAX_TIME_LIMIT, default_limit if requested is None else float(requested)))

    # Counts only; never log the request body.
    logger.info("solve guests=%d tables=%d rules=%d", len(spec.guests), len(spec.tables), len(request.constraints.rules))

    if not spec.guests:
        return _response("OPTIMAL", proven=True, objective=0.0, warnings=warnings)

    pre = _precheck(spec)
    if pre:
        return _response("INFEASIBLE", warnings=warnings, diagnostics=pre)

    outcome = solve_spec(spec, time_limit_seconds=limit)
    if outcome.status == "INFEASIBLE":
        conflicts = find_conflicts(spec, limit)
        return _response(
            "INFEASIBLE",
            warnings=warnings,
            diagnostics=[_notice(c.code, c.message, c.rule_ids) for c in conflicts],
        )
    if outcome.status == "UNKNOWN":
        return _response(
            "UNKNOWN",
            warnings=warnings,
            diagnostics=[_notice("SOLVER_UNKNOWN", "The solver found no answer within the time limit.")],
        )

    assignments = [
        Assignment(guest_id=guest_id, table_object_id=table_id)
        for guest_id, table_id in sorted(outcome.assignments.items())
    ]
    unassigned = sorted(g.id for g in spec.guests if g.id not in outcome.assignments)
    penalties = [
        PenaltyEntry(rule_id=soft.rule_id, penalty=float(outcome.penalties.get(soft.rule_id, 0)))
        for soft in sorted(spec.soft, key=lambda s: s.rule_id)
    ]
    return _response(
        outcome.status,
        proven=outcome.status == "OPTIMAL",
        assignments=assignments,
        unassigned=unassigned,
        objective=outcome.objective_value,
        penalties=penalties,
        warnings=warnings,
    )