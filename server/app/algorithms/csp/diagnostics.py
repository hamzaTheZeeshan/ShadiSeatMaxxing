from dataclasses import dataclass
from itertools import combinations

from app.algorithms.csp.model_builder import (
    GROUP_APART_RULES,
    GROUP_GENDER_ZONES,
    GROUP_HOUSEHOLDS,
    GROUP_LOCKS,
    GROUP_TOGETHER_RULES,
    ProblemSpec,
    effective_locks,
)
from app.algorithms.csp.solver import solve_spec

MAX_DIAGNOSTIC_SECONDS = 5.0

_LABELS: dict[str, str] = {
    GROUP_HOUSEHOLDS: "The household rule (households sit together)",
    GROUP_TOGETHER_RULES: "The must-sit-together rules",
    GROUP_APART_RULES: "The must-sit-apart rules",
    GROUP_GENDER_ZONES: "The gender zones",
    GROUP_LOCKS: "The locked seats",
}


@dataclass(frozen=True)
class Conflict:
    code: str
    message: str
    rule_ids: tuple[str, ...]


def _present_groups(spec: ProblemSpec) -> dict[str, tuple[str, ...]]:
    # Hard-rule groups that exist in this problem, with the rule ids that belong to each.
    groups: dict[str, tuple[str, ...]] = {}
    if any(t.rule_id is None for t in spec.together):
        groups[GROUP_HOUSEHOLDS] = ()
    together_ids = sorted(t.rule_id for t in spec.together if t.rule_id is not None)
    if together_ids:
        groups[GROUP_TOGETHER_RULES] = tuple(together_ids)
    if spec.apart:
        groups[GROUP_APART_RULES] = tuple(sorted(a.rule_id for a in spec.apart))
    if spec.enforce_zones:
        groups[GROUP_GENDER_ZONES] = ()
    if effective_locks(spec):
        groups[GROUP_LOCKS] = ()
    return groups


def find_conflicts(spec: ProblemSpec, time_limit_seconds: float) -> list[Conflict]:
    # Re-solves copies of the model with hard-rule groups removed; the original model is never relaxed.
    groups = _present_groups(spec)
    names = sorted(groups)
    limit = max(1.0, min(time_limit_seconds, MAX_DIAGNOSTIC_SECONDS))

    def feasible_without(removed: tuple[str, ...]) -> bool:
        outcome = solve_spec(
            spec, time_limit_seconds=limit, disabled=frozenset(removed), with_objective=False
        )
        return outcome.status in ("OPTIMAL", "FEASIBLE")

    def describe(removed: tuple[str, ...]) -> Conflict:
        rule_ids = tuple(sorted({rule_id for name in removed for rule_id in groups[name]}))
        if len(removed) == 1:
            message = f"{_LABELS[removed[0]]} cannot all be satisfied together with the other hard rules."
        else:
            message = (
                f"{_LABELS[removed[0]]} conflict with {_LABELS[removed[1]][0].lower()}"
                f"{_LABELS[removed[1]][1:]}; no seating satisfies both."
            )
        return Conflict("HARD_RULE_CONFLICT", message, rule_ids)

    singles = [(name,) for name in names if feasible_without((name,))]
    if singles:
        return [describe(group) for group in singles]
    pairs = [pair for pair in combinations(names, 2) if feasible_without(pair)]
    if pairs:
        return [describe(pair) for pair in pairs]
    return [
        Conflict(
            "INFEASIBLE_UNEXPLAINED",
            "No seating exists, and removing hard-rule groups does not explain why. Check table capacities.",
            (),
        )
    ]