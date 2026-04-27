import Link from "next/link";
import type { CSSProperties } from "react";

export default function GarageRepairPage() {
  return (
    <main style={pageStyle} data-testid="garage-repair-page">
      <section style={panelStyle}>
        <h1 style={titleStyle}>Garage. Repairs</h1>
        <p style={mutedTextStyle}>
          Full, essential, and risk-it repair choices land in the repair
          purchase slice. The garage summary links here so the route is
          ready for that flow.
        </p>
        <Link href="/garage" style={linkStyle} data-testid="garage-repair-back">
          Back to garage
        </Link>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  fontFamily: "system-ui, sans-serif",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  maxWidth: "38rem",
};

const titleStyle: CSSProperties = {
  margin: "0 0 0.5rem",
};

const mutedTextStyle: CSSProperties = {
  color: "var(--muted, #aaa)",
};

const linkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: "1rem",
  border: "1px solid var(--accent, #8cf)",
  borderRadius: "6px",
  color: "var(--accent, #8cf)",
  padding: "0.55rem 0.75rem",
  textDecoration: "none",
};
