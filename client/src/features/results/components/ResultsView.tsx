import { useMemo, useState } from "react";
import { useConstraintStore } from "../../constraints/store/constraintStore";
import { useGuestStore } from "../../guests/store/guestStore";
import { useEditorStore } from "../../hall-designer/store/editorStore";
import { parseSeatingResult } from "../types/seatingResult";
import type { BrokenConstraint } from "../types/seatingResult";
import type { ConstraintContext } from "../utils/constraintReport";
import { buildSeatingModel } from "../utils/seatingModel";
import { ui } from "../ui";
import ConstraintAudit from "./ConstraintAudit";
import RawJsonInspector from "./RawJsonInspector";
import ResultsHallView from "./ResultsHallView";
import SeatingRoster from "./SeatingRoster";
import SolverSummary from "./SolverSummary";

const NO_BROKEN: readonly BrokenConstraint[] = [];

export default function ResultsView({ result }: { result: unknown }) {
  const guests = useGuestStore((s) => s.guests);
  const hall = useEditorStore((s) => s.hall);
  const objects = useEditorStore((s) => s.objects);
  const settings = useConstraintStore((s) => s.settings);
  const zones = useConstraintStore((s) => s.zones);
  const rules = useConstraintStore((s) => s.rules);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const parsed = useMemo(() => parseSeatingResult(result), [result]);
  const model = useMemo(() => buildSeatingModel(objects, guests, parsed), [objects, guests, parsed]);
  const ctx = useMemo<ConstraintContext>(
    () => ({ settings, zones, rules, broken: parsed?.broken_constraints ?? NO_BROKEN, model }),
    [settings, zones, rules, parsed, model],
  );
  const jsonTabs = useMemo(
    () => [
      { id: "solver-result", label: "Solver result", data: result },
      { id: "hall-layout", label: "Hall layout", data: { hall, objects } },
      { id: "constraints", label: "Constraints", data: { settings, zones, rules } },
      { id: "guests", label: "Guests", data: guests },
    ],
    [result, hall, objects, settings, zones, rules, guests],
  );

  const toggleGuest = (id: string) => setSelectedGuestId((prev) => (prev === id ? null : id));
  const selectedName = selectedGuestId ? model.guestById.get(selectedGuestId)?.name : undefined;

  if (parsed === null) {
    return (
      <>
        <section style={ui.card}>
          <h2 style={ui.h2}>Unrecognised solver output</h2>
          <p style={{ ...ui.muted, margin: 0 }}>
            The response does not look like a seating plan (no <code>assignments</code> array). The raw payload is available below.
          </p>
        </section>
        <RawJsonInspector tabs={jsonTabs} />
      </>
    );
  }

  return (
    <>
      <SolverSummary result={parsed} model={model} />

      <section style={ui.card}>
        <h2 style={ui.h2}>Seating plan</h2>
        {selectedName ? (
          <p style={{ ...ui.muted, margin: "0 0 10px" }}>
            Highlighting <strong>{selectedName}</strong>{" "}
            <button type="button" style={ui.chip} onClick={() => setSelectedGuestId(null)}>
              Clear
            </button>
          </p>
        ) : null}
        <ResultsHallView hall={hall} objects={objects} model={model} ctx={ctx} highlightGuestId={selectedGuestId} />
      </section>

      <ConstraintAudit ctx={ctx} onSelectGuest={toggleGuest} />
      <SeatingRoster ctx={ctx} selectedGuestId={selectedGuestId} onSelectGuest={toggleGuest} />
      <RawJsonInspector tabs={jsonTabs} />
    </>
  );
}