import type { CSSProperties } from "react";
import {
  AGE_BANDS,
  DIETARY_OPTIONS,
  GENDERS,
  MOBILITY_LEVELS,
  ROLES,
  SIDES,
  VIP_LEVELS,
  optionLabel,
} from "../../guests/types/guestSchema";
import type { ConstraintContext } from "../utils/constraintReport";
import { composition, guestChecks, objectBroken, cleanMessage, zoneLabel } from "../utils/constraintReport";
import type { SeatObject, SeatSlot } from "../utils/seatingModel";
import CheckList from "./CheckList";
import { ACCENT, BORDER, INK, MUTED } from "../ui";

const dl: CSSProperties = { display: "grid", gridTemplateColumns: "96px 1fr", gap: "2px 8px", margin: 0, fontSize: 12 };
const heading: CSSProperties = {
  margin: "10px 0 4px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: ACCENT,
};

function Rows({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl style={dl}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ color: MUTED }}>{k}</dt>
          <dd style={{ margin: 0, wordBreak: "break-word" }}>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  seatObject: SeatObject;
  slot: SeatSlot | null; // null = the table/sofa body was hovered, not a single seat
  ctx: ConstraintContext;
  pinned: boolean;
  onClose: () => void;
}

export default function SeatTooltip({ seatObject, slot, ctx, pinned, onClose }: Props) {
  const guest = slot?.guest ?? null;
  const filled = seatObject.slots.filter((s) => s.guest !== null).length;
  const comp = composition(seatObject);
  const { object } = seatObject;

  const seatRows: Array<readonly [string, string]> = [
    ["Object", `${seatObject.label} · ${seatObject.kind === "table" && object.type === "table" ? `${object.shape} table` : "sofa"}`],
    ["Object ID", object.id],
    ["Seat index", slot ? `${slot.index} (seat ${slot.index + 1} of ${seatObject.capacity})` : "—"],
    ["Zone", zoneLabel(ctx, seatObject)],
    ["Occupancy", `${filled} / ${seatObject.capacity}`],
    ["Sides here", `${comp.bride} bride · ${comp.groom} groom · ${comp.other} other`],
    ["Age bands", comp.ageBands.join(", ")],
  ];

  return (
    <div
      style={{
        width: 320,
        maxHeight: 460,
        overflowY: pinned ? "auto" : "hidden",
        padding: 14,
        borderRadius: 12,
        background: "#ffffff",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 12px 32px rgba(17, 24, 39, 0.18)",
        color: INK,
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {guest ? guest.name : slot ? "Empty seat" : `${seatObject.label} overview`}
          </div>
          {pinned ? null : <div style={{ fontSize: 11, color: MUTED }}>Click to pin</div>}
        </div>
        {pinned ? (
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>
            ×
          </button>
        ) : null}
      </div>

      {guest ? (
        <>
          <div style={heading}>Guest</div>
          <Rows
            rows={[
              ["ID", guest.id],
              ["Household", guest.household],
              ["Side", optionLabel(SIDES, guest.side)],
              ["Gender", optionLabel(GENDERS, guest.gender)],
              ["Age band", optionLabel(AGE_BANDS, guest.age_band)],
              ["Role", optionLabel(ROLES, guest.role)],
              ["VIP", optionLabel(VIP_LEVELS, guest.vip)],
              ["Mobility", optionLabel(MOBILITY_LEVELS, guest.mobility)],
              ["Dietary", optionLabel(DIETARY_OPTIONS, guest.dietary)],
              ["Notes", guest.notes],
            ]}
          />
        </>
      ) : null}

      <div style={heading}>Seat &amp; table</div>
      <Rows rows={seatRows} />

      {guest && slot ? (
        <>
          <div style={heading}>Constraints</div>
          <CheckList items={guestChecks(ctx, guest, seatObject)} />
        </>
      ) : null}

      {!slot ? (
        <>
          <div style={heading}>Seated here</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {seatObject.slots.map((s) => (
              <li key={s.index} style={{ color: s.guest ? INK : MUTED }}>
                {s.guest ? s.guest.name : "empty"}
              </li>
            ))}
          </ol>
          <div style={heading}>Issues at this {seatObject.kind}</div>
          {(() => {
            const issues = objectBroken(ctx, seatObject);
            if (issues.length === 0) return <p style={{ margin: 0, fontSize: 12, color: MUTED }}>No broken constraints.</p>;
            return (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                {issues.map((b, i) => (
                  <li key={`${b.code}-${i}`}>{cleanMessage(b.message)}</li>
                ))}
              </ul>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}