import logging
from dataclasses import dataclass

from app.algorithms.csp.union_find import UnionFind
from app.schemas.constraint import (
    ConstraintData,
    ConstraintIssue,
    ConstraintValidationSummary,
    Rule,
    ValidateConstraintsRequest,
    ValidateConstraintsResponse,
    Zone,
    zone_for_table,
)
from app.schemas.guest import Guest
from app.schemas.layout import (
    EntranceObject,
    ExitObject,
    HallLayout,
    StageObject,
    TableObject,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LayoutTable:
    id: str
    label: str  # T<n>, n = 1-based order among tables in objects[]
    capacity: int


@dataclass(frozen=True)
class LayoutSummary:
    tables: tuple[LayoutTable, ...]
    has_stage: bool
    has_entrance: bool


def summarize_layout(layout: HallLayout) -> LayoutSummary:
    tables: list[LayoutTable] = []
    has_stage = False
    has_entrance = False
    table_number = 0
    for obj in layout.objects:
        if isinstance(obj, TableObject):
            table_number += 1
            tables.append(LayoutTable(obj.id, f"T{table_number}", obj.capacity))
        elif isinstance(obj, StageObject):
            has_stage = True
        elif isinstance(obj, (EntranceObject, ExitObject)):
            has_entrance = True
    return LayoutSummary(tuple(tables), has_stage, has_entrance)


def _zone_allows(zone: Zone, gender: str) -> bool:
    if zone == "men":
        return gender == "male"
    if zone == "women":
        return gender == "female"
    return True


def _rule_label(rule: Rule) -> str:
    return f"Rule {rule.id} ({rule.strength} {rule.kind})"


def _list_names(names: list[str]) -> str:
    shown = ", ".join(names[:3])
    return f"{shown} and {len(names) - 3} more" if len(names) > 3 else shown


def _issue(issue_id: str, severity: str, message: str, rule_id: str | None = None) -> ConstraintIssue:
    return ConstraintIssue(
        id=issue_id,
        severity="error" if severity == "error" else "warning",
        message=message,
        ruleId=rule_id,
    )


def validate_constraints(
    data: ConstraintData, guests: list[Guest], layout: LayoutSummary
) -> list[ConstraintIssue]:
    issues: list[ConstraintIssue] = []
    settings = data.settings
    by_id = {g.id: g for g in guests}

    # 1. Unknown guests
    for rule in data.rules:
        seen: set[str] = set()
        for gid in rule.guest_ids:
            if gid in by_id or gid in seen:
                continue
            seen.add(gid)
            issues.append(
                _issue(
                    f"missing-guest:{rule.id}:{gid}",
                    "error",
                    f'{_rule_label(rule)} references guest "{gid}", who does not exist.',
                    rule.id,
                )
            )

    # Guardian links (server-side addition): dangling or self-referencing is an error.
    for guest in guests:
        if guest.guardian_id is None:
            continue
        if guest.guardian_id == guest.id:
            issues.append(
                _issue(f"guardian-self:{guest.id}", "error", f"{guest.name} is listed as their own guardian.")
            )
        elif guest.guardian_id not in by_id:
            issues.append(
                _issue(
                    f"guardian-missing:{guest.id}",
                    "error",
                    f'{guest.name} has guardian "{guest.guardian_id}", who does not exist.',
                )
            )

    # Must-together groups (rules + households)
    uf = UnionFind()
    participants: set[str] = set()
    for rule in data.rules:
        if rule.kind != "together" or rule.strength != "must":
            continue
        ids = [gid for gid in dict.fromkeys(rule.guest_ids) if gid in by_id]
        if len(ids) < 2:
            continue
        for gid in ids:
            uf.union(ids[0], gid)
            participants.add(gid)
    if settings.households_together:
        households: dict[str, list[str]] = {}
        for guest in guests:
            household = guest.household.strip()
            if household == "":
                continue
            households.setdefault(household, []).append(guest.id)
        for members in households.values():
            if len(members) < 2:
                continue
            for gid in members:
                uf.union(members[0], gid)
                participants.add(gid)
    group_map: dict[str, list[str]] = {}
    for gid in sorted(participants):
        group_map.setdefault(uf.find(gid), []).append(gid)
    groups = [members for members in group_map.values() if len(members) > 1]

    # 2. Conflicts between must-apart rules and forced groups
    for rule in data.rules:
        if rule.kind != "apart" or rule.strength != "must":
            continue
        a, b = rule.guest_ids[0], rule.guest_ids[1]
        if a == b:
            continue
        guest_a = by_id.get(a)
        guest_b = by_id.get(b)
        if guest_a is None or guest_b is None:
            continue
        if uf.find(a) == uf.find(b):
            issues.append(
                _issue(
                    f"conflict:{rule.id}",
                    "error",
                    f"Conflict: {_rule_label(rule)} keeps {guest_a.name} and {guest_b.name} apart, "
                    "but must-together rules or households force them to share a table.",
                    rule.id,
                )
            )

    # 3. Groups larger than any table
    max_capacity = max([0, *(t.capacity for t in layout.tables)])
    if groups and not layout.tables:
        issues.append(
            _issue(
                "groups-need-tables",
                "warning",
                "Some guests must sit together, but the hall has no tables yet.",
            )
        )
    else:
        for group in groups:
            if len(group) <= max_capacity:
                continue
            names = [by_id[gid].name if gid in by_id else gid for gid in group]
            issues.append(
                _issue(
                    f"group-too-large:{group[0]}",
                    "error",
                    f"{len(group)} guests must sit together ({_list_names(names)}), "
                    f"but the largest table seats {max_capacity}.",
                )
            )

    # 4 + 5. Gender zones
    if settings.enforce_gender_zones:
        male_seats = 0
        female_seats = 0
        for table in layout.tables:
            zone = zone_for_table(data.zones, table.id)
            if _zone_allows(zone, "male"):
                male_seats += table.capacity
            if _zone_allows(zone, "female"):
                female_seats += table.capacity
        male_count = sum(1 for g in guests if g.gender == "male")
        female_count = sum(1 for g in guests if g.gender == "female")
        if male_count > male_seats:
            issues.append(
                _issue(
                    "gender-seats:male",
                    "error",
                    f"{male_count} male guests but only {male_seats} seats at men, family or mixed tables.",
                )
            )
        if female_count > female_seats:
            issues.append(
                _issue(
                    "gender-seats:female",
                    "error",
                    f"{female_count} female guests but only {female_seats} seats at women, family or mixed tables.",
                )
            )
        for group in groups:
            members = [by_id.get(gid) for gid in group]
            has_male = any(m is not None and m.gender == "male" for m in members)
            has_female = any(m is not None and m.gender == "female" for m in members)
            if not (has_male and has_female):
                continue
            roomy = any(
                zone_for_table(data.zones, t.id) in ("family", "mixed") and t.capacity >= len(group)
                for t in layout.tables
            )
            if not roomy:
                issues.append(
                    _issue(
                        f"mixed-group-no-table:{group[0]}",
                        "error",
                        f"A group of {len(group)} men and women must sit together, "
                        "but no family or mixed table is big enough.",
                    )
                )

    # 6. Missing stage / entrance
    if settings.vip_near_stage and not layout.has_stage and any(g.vip != "none" for g in guests):
        issues.append(
            _issue(
                "vip-no-stage",
                "warning",
                "VIP guests should sit near the stage, but the hall has no stage.",
            )
        )
    if settings.accessible_near_entrance and not layout.has_entrance and any(
        g.mobility != "none" for g in guests
    ):
        issues.append(
            _issue(
                "mobility-no-entrance",
                "warning",
                "Guests with mobility needs should sit near an entrance, "
                "but the hall has no entrance or exit.",
            )
        )

    # 7. Stale zones
    table_ids = {t.id for t in layout.tables}
    for table_id in data.zones:
        if table_id in table_ids:
            continue
        issues.append(
            _issue(
                f"stale-zone:{table_id}",
                "warning",
                f'A zone is set for table "{table_id}", which is not in the hall.',
            )
        )

    # 8. Capacity
    total_seats = sum(t.capacity for t in layout.tables)
    if len(guests) > total_seats:
        issues.append(
            _issue("guests-exceed-seats", "warning", f"{len(guests)} guests but only {total_seats} seats.")
        )

    # 9. Kids table
    if settings.kids_table:
        children = sum(1 for g in guests if g.age_band == "child")
        if children < 3:
            issues.append(
                _issue(
                    "kids-table-few-children",
                    "warning",
                    f"Kids table is on, but only {children} guests are aged 5-12.",
                )
            )

    issues.sort(key=lambda issue: (0 if issue.severity == "error" else 1, issue.id))
    return issues


def run_validation(request: ValidateConstraintsRequest) -> ValidateConstraintsResponse:
    issues = validate_constraints(request.constraints, request.guests, summarize_layout(request.layout))
    errors = sum(1 for issue in issues if issue.severity == "error")
    # Counts only; never log guests, rules or the layout.
    logger.info(
        "validate_constraints guests=%d rules=%d errors=%d warnings=%d",
        len(request.guests),
        len(request.constraints.rules),
        errors,
        len(issues) - errors,
    )
    return ValidateConstraintsResponse(
        valid=errors == 0,
        summary=ConstraintValidationSummary(errors=errors, warnings=len(issues) - errors),
        issues=issues,
    )