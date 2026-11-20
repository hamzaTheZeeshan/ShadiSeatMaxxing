import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useConstraintStore } from "../features/constraints/store/constraintStore";
import { useEventStore } from "../features/event/store/eventStore";
import { useGuestStore } from "../features/guests/store/guestStore";

interface Step {
  label: string;
  to?: string;
  note?: string;
  subtitle?: string;
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
  intro: { margin: "0 0 24px", fontSize: 15, color: "#4b5563" } satisfies CSSProperties,
  stepper: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    height: "100%",
    padding: 16,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    textDecoration: "none",
  } satisfies CSSProperties,
  cardActive: {
    background: "#ffffff",
    color: "#111827",
    borderColor: "#111827",
    cursor: "pointer",
  } satisfies CSSProperties,
  cardDisabled: {
    background: "#e5e7eb",
    color: "#9ca3af",
    cursor: "not-allowed",
  } satisfies CSSProperties,
  number: { fontSize: 12, fontWeight: 600 } satisfies CSSProperties,
  label: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: {
    fontSize: 13,
    color: "#4b5563",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  note: { fontSize: 13 } satisfies CSSProperties,
};

export default function HomePage() {
  const eventName = useEventStore((s) => s.event.event_name);
  const guestCount = useGuestStore((s) => s.guests.length);
  const ruleCount = useConstraintStore((s) => s.rules.length);

  const steps: Step[] = [
    { label: "Event", to: "/event", note: "Set up event", subtitle: eventName },
    { label: "Hall", to: "/designer", note: "Open designer" },
    {
      label: "Guests",
      to: "/guests",
      note: "Manage guests",
      subtitle: guestCount > 0 ? `${guestCount} ${guestCount === 1 ? "guest" : "guests"}` : "",
    },
    {
      label: "Constraints",
      to: "/constraints",
      note: "Set rules and zones",
      subtitle: ruleCount > 0 ? `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}` : "",
    },
    { label: "Results" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Plan your wedding hall</h1>
        <p style={styles.intro}>Work through the steps in order. Start by designing your hall layout.</p>
        <ol style={styles.stepper}>
          {steps.map((step, index) => (
            <li key={step.label}>
              {step.to ? (
                <Link to={step.to} style={{ ...styles.card, ...styles.cardActive }}>
                  <span style={styles.number}>Step {index + 1}</span>
                  <span style={styles.label}>{step.label}</span>
                  {step.subtitle ? <span style={styles.subtitle}>{step.subtitle}</span> : null}
                  <span style={styles.note}>{step.note}</span>
                </Link>
              ) : (
                <div aria-disabled="true" style={{ ...styles.card, ...styles.cardDisabled }}>
                  <span style={styles.number}>Step {index + 1}</span>
                  <span style={styles.label}>{step.label}</span>
                  <span style={styles.note}>Coming soon</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}