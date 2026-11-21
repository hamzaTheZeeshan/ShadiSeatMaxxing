import type { CSSProperties } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

// No global CSS exists yet: minimal reset so the 100vh shell has no margin-induced scroll.
const GLOBAL_RESET = "html,body{margin:0;padding:0}*,*::before,*::after{box-sizing:border-box}";

const styles = {
  root: {
    height: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f3f4f6",
    fontFamily: "system-ui, sans-serif",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "10px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  } satisfies CSSProperties,
  brand: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    textDecoration: "none",
  } satisfies CSSProperties,
  nav: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } satisfies CSSProperties,
};

function navLinkStyle({ isActive }: { isActive: boolean }): CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: 14,
    borderRadius: 6,
    textDecoration: "none",
    fontWeight: isActive ? 600 : 400,
    color: isActive ? "#ffffff" : "#374151",
    background: isActive ? "#111827" : "transparent",
  };
}

export default function AppShell() {
  return (
    <div style={styles.root}>
      <style>{GLOBAL_RESET}</style>
      <header style={styles.header}>
        <Link to="/" style={styles.brand}>
          Shadi Maxing
        </Link>
        <nav style={styles.nav} aria-label="Main">
          <NavLink to="/" end style={navLinkStyle}>
            Home
          </NavLink>
          <NavLink to="/designer" style={navLinkStyle}>
            Hall Designer
          </NavLink>
        </nav>
      </header>
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}