import type { SeatingResult, SolverStatus } from "../types/seatingResult";
import type { SeatingModel } from "../utils/seatingModel";
import { badgeStyle, BORDER, MUTED, ui } from "../ui";
import type { Tone } from "../ui";

const STATUS_TONE: Record<SolverStatus, Tone> = { OPTIMAL: "good", FEASIBLE: "info", INFEASIBLE: "bad", UNKNOWN: "warn" };

function formatTime(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, border: `2px solid ${BORDER}`, background: "#fff4dc" }}>
      <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{children}</div>
    </div>
  );
}

interface Props {
  result: SeatingResult;
  model: SeatingModel;
}

export default function SolverSummary({ result, model }: Props) {
  const seated = model.placementByGuest.size;
  const unassigned = model.unassignedGuests.length;
  const capacity = model.seatObjects.reduce((sum, s) => sum + s.capacity, 0);
  const hard = result.broken_constraints.filter((b) => b.type === "hard").length;
  const soft = result.broken_constraints.length - hard;

  return (
    <section style={ui.card}>
      <h2 style={ui.h2}>Solver summary</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Stat label="Status">
          <span style={{ ...badgeStyle(STATUS_TONE[result.status]), fontSize: 14, padding: "4px 12px" }}>{result.status}</span>
        </Stat>
        <Stat label="Soft score">{result.score.toLocaleString()}</Stat>
        <Stat label="Execution time">{formatTime(result.execution_time_ms)}</Stat>
        <Stat label="Seated">{seated}</Stat>
        <Stat label="Unassigned">{unassigned}</Stat>
        <Stat label="Seat usage">
          {seated} / {capacity}
        </Stat>
        <Stat label="Broken hard rules">{hard}</Stat>
        <Stat label="Missed preferences">{soft}</Stat>
      </div>

      {result.messages.length > 0 ? (
        <>
          <h3 style={ui.h3}>Solver messages</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            {result.messages.map((m, i) => (
              <li key={`${i}-${m}`}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}

      {model.anomalies.length > 0 ? (
        <>
          <h3 style={ui.h3}>Mismatch with the current hall / guest list</h3>
          <p style={{ ...ui.muted, margin: "0 0 6px" }}>
            The hall or guests may have changed since this plan was generated. Re-run the solver to refresh it.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {model.anomalies.slice(0, 10).map((m, i) => (
              <li key={`${i}-${m}`}>{m}</li>
            ))}
            {model.anomalies.length > 10 ? <li>…and {model.anomalies.length - 10} more</li> : null}
          </ul>
        </>
      ) : null}
    </section>
  );
}