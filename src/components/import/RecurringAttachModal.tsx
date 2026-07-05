"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { RecurringOption } from "@/lib/recurring/queries";

const norm = (s: string) => s.trim().toLowerCase();

const optStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  width: "100%",
  padding: "var(--space-2)",
  border: "none",
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  fontSize: "var(--text-sm)",
  color: "var(--color-text-primary)",
};

export function RecurringAttachModal({
  open,
  onClose,
  options,
  onAttach,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  options: RecurringOption[];
  onAttach: (option: RecurringOption) => void;
  /** Créer une récurrente à la volée depuis le libellé de la ligne. */
  onCreate?: (name: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? options.filter((o) => norm(o.name).includes(q)) : options;
  }, [options, query]);

  const exactExists = options.some((o) => norm(o.name) === norm(query.trim()));

  function attach(option: RecurringOption) {
    onAttach(option);
    setQuery("");
    onClose();
  }

  function create() {
    const name = query.trim();
    if (!name || !onCreate) return;
    onCreate(name);
    setQuery("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Associer à une récurrente">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une récurrente…"
        />
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              style={optStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => attach(o)}
            >
              {o.name}
            </button>
          ))}
          {onCreate && query.trim() && !exactExists && (
            <button
              type="button"
              style={{ ...optStyle, color: "var(--color-brand-primary-600)", fontWeight: "var(--fw-medium)" }}
              onClick={create}
            >
              <Plus size={14} aria-hidden />
              Créer «&nbsp;{query.trim()}&nbsp;»
            </button>
          )}
          {options.length === 0 && !query.trim() && (
            <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              Aucune récurrente. Tape un nom pour en créer une.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
