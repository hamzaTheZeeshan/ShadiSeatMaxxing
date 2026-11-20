import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import ConstraintImport from "../features/constraints/components/ConstraintImport";
import ConstraintIssues from "../features/constraints/components/ConstraintIssues";
import ConstraintSettingsPanel from "../features/constraints/components/ConstraintSettingsPanel";
import RuleForm from "../features/constraints/components/RuleForm";
import RuleList from "../features/constraints/components/RuleList";
import TableZonesPanel from "../features/constraints/components/TableZonesPanel";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import {
  loadConstraintsFromStorage,
  saveConstraintsToStorage,
} from "../features/constraints/utils/constraintPersistence";
import { useGuestStore } from "../features/guests/store/guestStore";

const STATUS_MS = 4000;

interface PageStatus {
  text: string;
  ok: boolean;
}

const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "32px 16px",
  } satisfies CSSProperties,
  inner: { maxWidth: 960, margin: "0 auto" } satisfies CSSProperties,
  heading: { margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "#111827" } satisfies CSSProperties,
  intro: { margin: "0 0 8px", fontSize: 15, color: "#4b5563" } satisfies CSSProperties,
  households: { margin: "0 0 24px", fontSize: 14, color: "#374151" } satisfies CSSProperties,
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, margin: "0 0 12px" } satisfies CSSProperties,
  links: { display: "flex", gap: 16, margin: "16px 0 0", fontSize: 14 } satisfies CSSProperties,
};

export default function ConstraintsPage() {
  const guests = useGuestStore((s) => s.guests);
  const householdsTogether = useConstraintStore((s) => s.settings.households_together);
  const [status, setStatus] = useState<PageStatus | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const householdCount = useMemo(() => {
    const sizes = new Map<string, number>();
    for (const g of guests) {
      if (g.household === "") continue;
      sizes.set(g.household, (sizes.get(g.household) ?? 0) + 1);
    }
    let count = 0;
    for (const size of sizes.values()) if (size > 1) count += 1;
    return count;
  }, [guests]);

  function show(text: string, ok: boolean) {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setStatus({ text, ok });
    timeoutRef.current = window.setTimeout(() => {
      setStatus(null);
      timeoutRef.current = null;
    }, STATUS_MS);
  }

  function handleSave() {
    const { settings, zones, rules } = useConstraintStore.getState();
    const result = saveConstraintsToStorage({ version: 1, settings, zones, rules });
    if (result.ok) show("Saved to this browser.", true);
    else show(result.error, false);
  }

  function handleLoad() {
    const result = loadConstraintsFromStorage();
    if (!result.ok) {
      show(result.error, false);
      return;
    }
    if (useConstraintStore.getState().replaceAll(result.value)) show("Loaded from this browser.", true);
    else show("Saved constraints could not be applied.", false);
  }

  function handleClear() {
    if (!window.confirm("Remove all rules? Settings and table zones are kept.")) return;
    useConstraintStore.getState().clearRules();
    show("All rules removed.", true);
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Constraints</h1>
        <p style={styles.intro}>Set seating rules and table zones. The solver will use them in a later step.</p>
        <p style={styles.households}>
          {householdsTogether
            ? `${householdCount} ${householdCount === 1 ? "household" : "households"} will be seated together automatically`
            : "Households are not kept together (turn this on in Settings)."}
        </p>

        <ConstraintSettingsPanel />
        <TableZonesPanel />
        <RuleForm />
        <RuleList />
        <ConstraintIssues />
        <ConstraintImport />

        <div style={styles.actions}>
          <button type="button" onClick={handleSave}>
            Save to browser
          </button>
          <button type="button" onClick={handleLoad}>
            Load from browser
          </button>
          <button type="button" onClick={handleClear}>
            Clear all rules
          </button>
        </div>
        <div role="status" style={{ minHeight: 20, fontSize: 14, color: status?.ok ? "#15803d" : "#b91c1c" }}>
          {status?.text ?? ""}
        </div>

        <div style={styles.links}>
          <Link to="/guests">Back: Guests</Link>
          <Link to="/designer">Back: Hall</Link>
        </div>
      </div>
    </div>
  );
}