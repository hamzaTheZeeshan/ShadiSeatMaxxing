from collections import Counter
from dataclasses import dataclass

from ortools.sat.python import cp_model

GROUP_HOUSEHOLDS = "households"
GROUP_TOGETHER_RULES = "together_rules"
GROUP_APART_RULES = "apart_rules"
GROUP_GENDER_ZONES = "gender_zones"
GROUP_LOCKS = "locks"


@dataclass(frozen=True)
class GuestSpec:
    id: str
    name: str
    gender: str


@dataclass(frozen=True)
class TableSpec:
    id: str
    capacity: int
    allows_male: bool
    allows_female: bool


@dataclass(frozen=True)
class TogetherSpec:
    # Hard: all guests share one table. rule_id is None for households.
    guest_ids: tuple[str, ...]
    rule_id: str | None


@dataclass(frozen=True)
class ApartSpec:
    # Hard: the two guests never share a table.
    rule_id: str
    a: str
    b: str


@dataclass(frozen=True)
class SoftPairSpec:
    # Soft: penalty `weight` when a "together" pair is split, or an "apart" pair shares a table.
    rule_id: str
    a: str
    b: str
    weight: int
    together: bool


@dataclass(frozen=True)
class ProblemSpec:
    guests: tuple[GuestSpec, ...]
    tables: tuple[TableSpec, ...]
    together: tuple[TogetherSpec, ...]
    apart: tuple[ApartSpec, ...]
    soft: tuple[SoftPairSpec, ...]
    enforce_zones: bool
    # Raw (guest_id, table_object_id) locks as received, duplicates included.
    locks: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class BuiltModel:
    model: cp_model.CpModel
    x: dict[tuple[int, int], cp_model.IntVar]
    penalty_terms: list[tuple[str, int, cp_model.IntVar]]


def effective_locks(spec: ProblemSpec) -> dict[str, str]:
    # Only locks that are unique per guest and point at known guests and tables.
    counts = Counter(guest_id for guest_id, _ in spec.locks)
    guest_ids = {g.id for g in spec.guests}
    table_ids = {t.id for t in spec.tables}
    return {
        guest_id: table_id
        for guest_id, table_id in spec.locks
        if counts[guest_id] == 1 and guest_id in guest_ids and table_id in table_ids
    }


def build_model(spec: ProblemSpec, disabled: frozenset[str], with_objective: bool) -> BuiltModel:
    model = cp_model.CpModel()
    guest_index = {g.id: i for i, g in enumerate(spec.guests)}
    table_index = {t.id: j for j, t in enumerate(spec.tables)}
    n_guests = len(spec.guests)
    n_tables = len(spec.tables)

    x: dict[tuple[int, int], cp_model.IntVar] = {
        (i, j): model.new_bool_var(f"x_{i}_{j}") for i in range(n_guests) for j in range(n_tables)
    }

    for i in range(n_guests):
        model.add_exactly_one([x[i, j] for j in range(n_tables)])
    for j, table in enumerate(spec.tables):
        model.add(sum(x[i, j] for i in range(n_guests)) <= table.capacity)

    for together in spec.together:
        group = GROUP_HOUSEHOLDS if together.rule_id is None else GROUP_TOGETHER_RULES
        if group in disabled:
            continue
        first = guest_index[together.guest_ids[0]]
        for guest_id in together.guest_ids[1:]:
            i = guest_index[guest_id]
            for j in range(n_tables):
                model.add(x[i, j] == x[first, j])

    if GROUP_APART_RULES not in disabled:
        for apart in spec.apart:
            a = guest_index[apart.a]
            b = guest_index[apart.b]
            for j in range(n_tables):
                model.add(x[a, j] + x[b, j] <= 1)

    if spec.enforce_zones and GROUP_GENDER_ZONES not in disabled:
        for i, guest in enumerate(spec.guests):
            for j, table in enumerate(spec.tables):
                if guest.gender == "male" and not table.allows_male:
                    model.add(x[i, j] == 0)
                elif guest.gender == "female" and not table.allows_female:
                    model.add(x[i, j] == 0)

    if GROUP_LOCKS not in disabled:
        for guest_id, table_id in effective_locks(spec).items():
            model.add(x[guest_index[guest_id], table_index[table_id]] == 1)

    penalty_terms: list[tuple[str, int, cp_model.IntVar]] = []
    if with_objective:
        for soft in spec.soft:
            a = guest_index[soft.a]
            b = guest_index[soft.b]
            flag = model.new_bool_var(f"soft_{soft.rule_id}")
            for j in range(n_tables):
                if soft.together:
                    # flag = 1 when the pair is split across tables.
                    model.add(flag >= x[a, j] - x[b, j])
                else:
                    # flag = 1 when the pair shares a table.
                    model.add(flag + 1 >= x[a, j] + x[b, j])
            penalty_terms.append((soft.rule_id, soft.weight, flag))
        if penalty_terms:
            model.minimize(sum(weight * flag for _, weight, flag in penalty_terms))

    return BuiltModel(model=model, x=x, penalty_terms=penalty_terms)