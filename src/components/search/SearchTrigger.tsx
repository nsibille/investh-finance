"use client";

import { Search } from "lucide-react";

export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("lyra:search"))}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 36,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-subtle)",
        color: "var(--color-text-muted)",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
      }}
      aria-label="Rechercher"
    >
      <Search size={16} />
      <span>Rechercher</span>
      <kbd
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          padding: "0 var(--space-1)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-bg-surface)",
        }}
      >
        ⌘K
      </kbd>
    </button>
  );
}
