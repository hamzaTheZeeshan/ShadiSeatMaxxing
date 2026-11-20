from dataclasses import dataclass
from typing import Literal

from ortools.sat.python import cp_model

from app.algorithms.csp.model_builder import ProblemSpec, build_model

RANDOM_SEED = 1

OutcomeStatus = Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN"]


@dataclass(frozen=True)
class SolveOutcome:
    status: OutcomeStatus
    assignments: dict[str, str]
    objective_value: float | None
    penalties: dict[str, int]


def solve_spec(
    spec: ProblemSpec,
    *,
    time_limit_seconds: float,
    disabled: frozenset[str] = frozenset(),
    with_objective: bool = True,
) -> SolveOutcome:
    built = build_model(spec, disabled, with_objective)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.random_seed = RANDOM_SEED
    solver.parameters.num_workers = 1
    solver.parameters.log_search_progress = False
    raw_status = solver.solve(built.model)

    if raw_status == cp_model.INFEASIBLE:
        return SolveOutcome("INFEASIBLE", {}, None, {})
    if raw_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveOutcome("UNKNOWN", {}, None, {})

    # Never report a time-limited result as optimal: only CP-SAT's OPTIMAL counts.
    status: OutcomeStatus = "OPTIMAL" if raw_status == cp_model.OPTIMAL else "FEASIBLE"
    assignments: dict[str, str] = {}
    for i, guest in enumerate(spec.guests):
        for j, table in enumerate(spec.tables):
            if solver.value(built.x[i, j]) == 1:
                assignments[guest.id] = table.id
                break
    penalties = {
        rule_id: weight * int(solver.value(flag)) for rule_id, weight, flag in built.penalty_terms
    }
    return SolveOutcome(status, assignments, float(sum(penalties.values())), penalties)