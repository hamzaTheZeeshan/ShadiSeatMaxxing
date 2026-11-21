import { RULE_KINDS, RULE_STRENGTHS, ZONES, zoneForTable } from "../../constraints/types/constraintSchema";
import { optionLabel } from "../../guests/types/guestSchema";
import type { ConstraintContext } from "../utils/constraintReport";
import { cleanMessage } from "../utils/constraintReport";
import { badgeStyle, MUTED, ui } from "../ui";
import type { Tone } from "../ui";

interface SettingRow {
  label: string;
  enabled: boolean;
  tier: string;
  detail: string;
  code?: string; // matches BrokenConstraint.code
}

function settingRows(ctx: ConstraintContext): SettingRow[] {
  const s = ctx.settings;
  const w = s.weights;
  return [
    { label: "Households together", enabled: s.households_together, tier: "Relaxable hard rule", detail: "Household members share one table/sofa", code: "households_together" },
    { label: "Gender zones", enabled: s.enforce_gender_zones, tier: "Relaxable hard rule", detail: "Men/Women zones exclude the other gender", code: "enforce_gender_zones" },
    { label: "Sofas for seniors only", enabled: s.sofas_for_seniors_only, tier: "Relaxable hard rule", detail: "Only seniors sit on sofas", code: "sofas_for_seniors_only" },
    { label: "Accessible near entrance", enabled: s.accessible_near_entrance, tier: "Preference", detail: `Within ${s.accessible_max_distance_m} m`, code: "accessible_near_entrance" },
    { label: "VIP near stage", enabled: s.vip_near_stage, tier: "Preference", detail: `Within ${s.vip_max_distance_m} m`, code: "vip_near_stage" },
    { label: "Children with guardian", enabled: s.children_with_guardian, tier: "Not modelled by solver", detail: "Setting is stored but not enforced" },
    { label: "Kids table", enabled: s.kids_table, tier: "Not modelled by solver", detail: "Setting is stored but not enforced" },
    { label: "Elders near exits", enabled: w.elders_near_exits > 0, tier: "Weighted preference", detail: `Weight ${w.elders_near_exits}/10` },
    { label: "Seniors near stage", enabled: w.seniors_near_stage > 0, tier: "Weighted preference", detail: `Weight ${w.seniors_near_stage}/10` },
    { label: "Balance sides", enabled: w.balance_sides > 0, tier: "Weighted preference", detail: `Weight ${w.balance_sides}/10` },
    { label: "Similar ages", enabled: w.similar_ages > 0, tier: "Weighted preference", detail: `Weight ${w.similar_ages}/10` },
  ];
}

interface Props {
  ctx: ConstraintContext;
  onSelectGuest: (id: string) => void;
}

export default function ConstraintAudit({ ctx, onSelectGuest }: Props) {
  const { broken, model, rules } = ctx;
  const hard = broken.filter((b) => b.type === "hard");
  const soft = broken.filter((b) => b.type === "soft");
  const nameOf = (id: string) => model.guestById.get(id)?.name ?? id;
  const zoned = model.seatObjects.filter((so) => zoneForTable(ctx.zones, so.object.id) !== "mixed");

  const renderBroken = (items: typeof broken, tone: Tone, title: string) => (
    <>
      <h3 style={ui.h3}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p style={{ ...ui.muted, margin: 0 }}>None.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {items.map((b, i) => (
            <li key={`${b.code}-${b.rule_id ?? ""}-${i}`} style={{ fontSize: 13 }}>
              <span style={badgeStyle(tone)}>{b.code}</span> {cleanMessage(b.message)}
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {b.guest_ids.map((id) => (
                  <button key={id} type="button" style={ui.chip} onClick={() => onSelectGuest(id)}>
                    {nameOf(id)}
                  </button>
                ))}
                {b.seat_ids.map((id) => (
                  <span key={id} style={badgeStyle("neutral")}>
                    {model.byId.get(id)?.label ?? id}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <section style={ui.card}>
      <h2 style={ui.h2}>Constraint audit</h2>
      {broken.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14 }}>
          <span style={badgeStyle("good")}>All clear</span> The solver reported no broken constraints.
        </p>
      ) : null}
      {renderBroken(hard, "bad", "Broken hard rules")}
      {renderBroken(soft, "warn", "Missed soft preferences")}

      <h3 style={ui.h3}>Active settings</h3>
      <div style={ui.tableWrap}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Setting</th>
              <th style={ui.th}>Enabled</th>
              <th style={ui.th}>Type</th>
              <th style={ui.th}>Detail</th>
              <th style={ui.th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {settingRows(ctx).map((r) => {
              const violations = r.code ? broken.filter((b) => b.code === r.code).length : null;
              return (
                <tr key={r.label}>
                  <td style={ui.td}>{r.label}</td>
                  <td style={ui.td}>
                    <span style={badgeStyle(r.enabled ? "good" : "neutral")}>{r.enabled ? "On" : "Off"}</span>
                  </td>
                  <td style={ui.td}>{r.tier}</td>
                  <td style={{ ...ui.td, color: MUTED }}>{r.detail}</td>
                  <td style={ui.td}>
                    {!r.enabled || violations === null ? (
                      "—"
                    ) : violations === 0 ? (
                      <span style={badgeStyle("good")}>No violations</span>
                    ) : (
                      <span style={badgeStyle(r.tier === "Preference" ? "warn" : "bad")}>
                        {violations} violation{violations === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={ui.h3}>Zones</h3>
      {zoned.length === 0 ? (
        <p style={{ ...ui.muted, margin: 0 }}>Every table and sofa uses the default Mixed zone.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {zoned.map((so) => (
            <span key={so.object.id} style={badgeStyle("info")}>
              {so.label}: {optionLabel(ZONES, zoneForTable(ctx.zones, so.object.id))}
            </span>
          ))}
        </div>
      )}

      <h3 style={ui.h3}>Custom rules ({rules.length})</h3>
      {rules.length === 0 ? (
        <p style={{ ...ui.muted, margin: 0 }}>No custom rules defined.</p>
      ) : (
        <div style={ui.tableWrap}>
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Rule</th>
                <th style={ui.th}>Guests</th>
                <th style={ui.th}>Weight</th>
                <th style={ui.th}>Note</th>
                <th style={ui.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const isBroken = broken.some((b) => b.rule_id === rule.id);
                return (
                  <tr key={rule.id}>
                    <td style={ui.td}>
                      {optionLabel(RULE_KINDS, rule.kind)} · {optionLabel(RULE_STRENGTHS, rule.strength)}
                    </td>
                    <td style={ui.td}>
                      {rule.guest_ids.map((id) => (
                        <button key={id} type="button" style={{ ...ui.chip, marginRight: 4 }} onClick={() => onSelectGuest(id)}>
                          {nameOf(id)}
                        </button>
                      ))}
                    </td>
                    <td style={ui.td}>{rule.strength === "prefer" ? rule.weight : "—"}</td>
                    <td style={{ ...ui.td, color: MUTED }}>{rule.note || "—"}</td>
                    <td style={ui.td}>
                      <span style={badgeStyle(isBroken ? (rule.strength === "must" ? "bad" : "warn") : "good")}>
                        {isBroken ? "Broken" : "Satisfied"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}