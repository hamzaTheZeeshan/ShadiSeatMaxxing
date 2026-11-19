import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    padding: "48px 16px",
    textAlign: "center",
  } satisfies CSSProperties,
  heading: { margin: "0 0 8px", fontSize: 24, color: "#111827" } satisfies CSSProperties,
  text: { margin: "0 0 16px", fontSize: 15, color: "#4b5563" } satisfies CSSProperties,
  link: { fontSize: 15, color: "#111827" } satisfies CSSProperties,
};

export default function NotFoundPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Page not found</h1>
      <p style={styles.text}>The page you are looking for does not exist.</p>
      <Link to="/" style={styles.link}>
        Back to Home
      </Link>
    </div>
  );
}