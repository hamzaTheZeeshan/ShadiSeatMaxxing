"""Request validation; mirrors the zod schemas (guestSchema.ts, constraintSchema.ts, layout.ts)."""
from __future__ import annotations

import re

from rest_framework import serializers

MAX_GUESTS = 2000
MAX_RULES = 2000

SIDES = ["bride", "groom", "other"]
GENDERS = ["male", "female", "unspecified"]
AGE_BANDS = ["infant", "child", "teen", "adult", "senior"]
ROLES = ["couple", "parent", "grandparent", "sibling", "wedding_party", "relative",
         "friend", "colleague", "family_friend", "other"]
VIP_LEVELS = ["none", "vip", "chief_guest"]
MOBILITY = ["none", "wheelchair", "walker", "assistance"]
DIETARY = ["none", "vegetarian", "allergy", "other"]
ZONES = ["men", "women", "family", "mixed"]
OBJECT_TYPES = ["wall", "table", "sofa", "entrance", "exit", "stage",
                "dance_floor", "restricted_area", "service_area"]

GUEST_ENUM_FIELDS = ["side", "gender", "age_band", "role", "vip", "mobility", "dietary"]


class GuestSerializer(serializers.Serializer):
    id = serializers.RegexField(r"^guest_[0-9a-f]{8}$", error_messages={"invalid": "Invalid guest id."})
    name = serializers.CharField(max_length=100)
    household = serializers.CharField(max_length=60, allow_blank=True, required=False, default="")
    side = serializers.ChoiceField(SIDES, required=False, default="other")
    gender = serializers.ChoiceField(GENDERS, required=False, default="unspecified")
    age_band = serializers.ChoiceField(AGE_BANDS, required=False, default="adult")
    role = serializers.ChoiceField(ROLES, required=False, default="other")
    vip = serializers.ChoiceField(VIP_LEVELS, required=False, default="none")
    mobility = serializers.ChoiceField(MOBILITY, required=False, default="none")
    dietary = serializers.ChoiceField(DIETARY, required=False, default="none")
    notes = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")

    def to_internal_value(self, data):
        # Same normalisation as the frontend: trim/lowercase enums, ""/null mean "missing".
        if isinstance(data, dict):
            data = dict(data)
            for key in GUEST_ENUM_FIELDS:
                v = data.get(key)
                if isinstance(v, str):
                    v = re.sub(r"\s+", "_", v.strip().lower())
                    if v == "":
                        data.pop(key)
                    else:
                        data[key] = v
                elif key in data and v is None:
                    data.pop(key)
            for key in ("household", "notes"):
                if key in data and data[key] is None:
                    data.pop(key)
        return super().to_internal_value(data)


class HallSerializer(serializers.Serializer):
    width = serializers.FloatField(min_value=0)
    height = serializers.FloatField(min_value=0)


class HallObjectSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.ChoiceField(OBJECT_TYPES)
    x = serializers.FloatField(required=False)
    y = serializers.FloatField(required=False)
    rotation = serializers.FloatField(required=False, default=0.0)
    shape = serializers.ChoiceField(["round", "rectangular", "square"], required=False)
    radius = serializers.FloatField(required=False, min_value=0)
    width = serializers.FloatField(required=False, min_value=0)
    height = serializers.FloatField(required=False, min_value=0)
    capacity = serializers.IntegerField(required=False, min_value=0)

    def validate(self, attrs):
        t = attrs["type"]
        if t == "wall":  # walls carry no seating or distance semantics here
            return attrs
        required = ["x", "y"]
        if t == "table":
            if "shape" not in attrs:
                raise serializers.ValidationError({"shape": "Tables need a shape."})
            required += ["capacity"] + (["radius"] if attrs["shape"] == "round" else ["width", "height"])
        elif t == "sofa":
            required += ["width", "height", "capacity"]
        elif t in ("entrance", "exit"):
            required += ["width"]
        else:
            required += ["width", "height"]
        missing = {f: "This field is required." for f in required if f not in attrs}
        if missing:
            raise serializers.ValidationError(missing)
        return attrs


class LayoutSerializer(serializers.Serializer):
    hall = HallSerializer(required=False)
    objects = HallObjectSerializer(many=True)

    def validate_objects(self, objs):
        ids = [o["id"] for o in objs]
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("Object ids must be unique.")
        return objs


class WeightsSerializer(serializers.Serializer):
    _w = dict(min_value=0, max_value=10, required=False)
    elders_near_exits = serializers.IntegerField(default=5, **_w)
    seniors_near_stage = serializers.IntegerField(default=3, **_w)
    balance_sides = serializers.IntegerField(default=3, **_w)
    similar_ages = serializers.IntegerField(default=2, **_w)

    def to_internal_value(self, data):
        return super().to_internal_value(data if data is not None else {})


class SettingsSerializer(serializers.Serializer):
    households_together = serializers.BooleanField(required=False, default=True)
    enforce_gender_zones = serializers.BooleanField(required=False, default=False)
    children_with_guardian = serializers.BooleanField(required=False, default=True)
    accessible_near_entrance = serializers.BooleanField(required=False, default=True)
    accessible_max_distance_m = serializers.FloatField(required=False, default=10, min_value=1, max_value=50)
    vip_near_stage = serializers.BooleanField(required=False, default=True)
    vip_max_distance_m = serializers.FloatField(required=False, default=12, min_value=1, max_value=50)
    kids_table = serializers.BooleanField(required=False, default=False)
    sofas_for_seniors_only = serializers.BooleanField(required=False, default=True)
    weights = WeightsSerializer(required=False)

    def to_internal_value(self, data):
        data = dict(data or {})
        data.setdefault("weights", {})
        return super().to_internal_value(data)


class RuleSerializer(serializers.Serializer):
    id = serializers.RegexField(r"^rule_[0-9a-f]{8}$", error_messages={"invalid": "Invalid rule id."})
    kind = serializers.ChoiceField(["together", "apart"])
    strength = serializers.ChoiceField(["must", "prefer"])
    weight = serializers.IntegerField(min_value=1, max_value=10, required=False, default=5)
    guest_ids = serializers.ListField(child=serializers.CharField(min_length=1))
    note = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        ids = attrs["guest_ids"]
        unique = len(set(ids)) == len(ids)
        ok = unique and (2 <= len(ids) <= 20 if attrs["kind"] == "together" else len(ids) == 2)
        if not ok:
            raise serializers.ValidationError(
                {"guest_ids": "Together rules need 2-20 different guests; apart rules need exactly 2 different guests."}
            )
        if attrs["strength"] == "must":
            attrs["weight"] = 5
        return attrs


class ConstraintsSerializer(serializers.Serializer):
    version = serializers.IntegerField(required=False)
    settings = SettingsSerializer(required=False)
    zones = serializers.DictField(child=serializers.ChoiceField(ZONES), required=False, default=dict)
    rules = RuleSerializer(many=True, required=False)

    def to_internal_value(self, data):
        data = dict(data or {})
        data.setdefault("settings", {})
        data.setdefault("rules", [])
        return super().to_internal_value(data)

    def validate_rules(self, rules):
        if len(rules) > MAX_RULES:
            raise serializers.ValidationError(f"Too many rules (max {MAX_RULES}).")
        if len({r["id"] for r in rules}) != len(rules):
            raise serializers.ValidationError("Rule ids must be unique.")
        return rules


class OptionsSerializer(serializers.Serializer):
    time_limit_seconds = serializers.FloatField(required=False, default=30.0, min_value=1, max_value=300)
    num_workers = serializers.IntegerField(required=False, default=8, min_value=1, max_value=32)


class SolveRequestSerializer(serializers.Serializer):
    layout = LayoutSerializer()
    guests = GuestSerializer(many=True)
    constraints = ConstraintsSerializer(required=False)
    options = OptionsSerializer(required=False)

    def to_internal_value(self, data):
        data = dict(data) if isinstance(data, dict) else data
        if isinstance(data, dict):
            data.setdefault("constraints", {})
            data.setdefault("options", {})
        return super().to_internal_value(data)

    def validate_guests(self, guests):
        if len(guests) > MAX_GUESTS:
            raise serializers.ValidationError(f"Too many guests (max {MAX_GUESTS}).")
        if len({g["id"] for g in guests}) != len(guests):
            raise serializers.ValidationError("Guest ids must be unique.")
        return guests