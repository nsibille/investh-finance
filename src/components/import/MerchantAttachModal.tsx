"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { createMerchant } from "@/server/actions/merchants";
import type { MerchantOption } from "@/lib/merchants/types";

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

export function MerchantAttachModal({
  open,
  onClose,
  merchantOptions,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  merchantOptions: MerchantOption[];
  onAttach: (option: MerchantOption) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = norm(query);
    return q
      ? merchantOptions.filter((m) => norm(m.name).includes(q))
      : merchantOptions;
  }, [merchantOptions, query]);

  const exactExists = merchantOptions.some((m) => norm(m.name) === norm(query));

  function attach(option: MerchantOption) {
    onAttach(option);
    setQuery("");
    onClose();
  }

  async function createAndAttach() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const res = await createMerchant({ name });
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Enseigne créée");
    attach({ id: res.id, name, subcategoryId: null });
  }

  return (
    <Modal open={open} onClose={onClose} title="Rattacher à une enseigne">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher ou créer une enseigne…"
        />
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              style={optStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => attach(m)}
            >
              {m.name}
            </button>
          ))}
          {query.trim() && !exactExists && (
            <button
              type="button"
              style={{ ...optStyle, color: "var(--color-brand-primary-600)", fontWeight: "var(--fw-medium)" }}
              disabled={creating}
              onClick={createAndAttach}
            >
              <Plus size={14} aria-hidden />
              Créer «&nbsp;{query.trim()}&nbsp;»
            </button>
          )}
          {filtered.length === 0 && !query.trim() && (
            <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              Aucune enseigne. Tape un nom pour en créer une.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
