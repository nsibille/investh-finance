export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "var(--text-4xl)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--color-brand-primary)",
          margin: 0,
        }}
      >
        Lyra
      </h1>
      <p
        style={{
          fontSize: "var(--text-base)",
          color: "var(--color-text-muted)",
          maxWidth: "32rem",
          margin: 0,
        }}
      >
        Finances personnelles — consolidation multi-comptes, catégorisation
        automatique et dashboards mensuels.
      </p>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-secondary)",
          background: "var(--color-bg-subtle)",
          padding: "var(--space-2) var(--space-3)",
          borderRadius: "var(--radius-md)",
        }}
      >
        1 234,56 €
      </code>
    </main>
  );
}
