"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { createPurchase } from "@/server/actions/purchases";
import type { PurchaseOption } from "@/lib/purchases/types";

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

/** Transaction d'origine quand on crée un achat depuis une ligne d'import. */
export interface FromTransaction {
  operationDate: string; // YYYY-MM-DD
  amount: number;
  label: string;
}

export function PurchaseAttachModal({
  open,
  onClose,
  purchaseOptions,
  onAttach,
  fromTransaction,
}: {
  open: boolean;
  onClose: () => void;
  purchaseOptions: PurchaseOption[];
  onAttach: (option: PurchaseOption) => void;
  /** Si fourni, la création propose un plan de mensualités pré-rempli. */
  fromTransaction?: FromTransaction | null;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // Nombre de mensualités quand on crée depuis une transaction (1 = direct).
  const [count, setCount] = useState("1");

  const filtered = useMemo(() => {
    const q = norm(query);
    return q
      ? purchaseOptions.filter((p) => norm(p.name).includes(q))
      : purchaseOptions;
  }, [purchaseOptions, query]);

  const exactExists = purchaseOptions.some((p) => norm(p.name) === norm(query));

  function reset() {
    setQuery("");
    setCount("1");
  }

  function attach(option: PurchaseOption) {
    onAttach(option);
    reset();
    onClose();
  }

  async function createAndAttach() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    // Depuis une transaction : montant + date + libellé peuplent les mensualités.
    let installmentPlan = null;
    if (fromTransaction) {
      const n = parseInt(count, 10);
      if (Number.isFinite(n) && n > 1) {
        installmentPlan = {
          count: n,
          startMonth: fromTransaction.operationDate.slice(0, 7),
          amount: -Math.abs(fromTransaction.amount),
          label: fromTransaction.label,
        };
      }
    }
    const res = await createPurchase({ name, installmentPlan });
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Achat créé");
    attach({ id: res.id, name, subcategoryId: null });
  }

  return (
    <Modal open={open} onClose={onClose} title="Rattacher à un achat">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher ou créer un achat…"
        />
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              style={optStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => attach(p)}
            >
              {p.name}
            </button>
          ))}
          {query.trim() && !exactExists && (
            <>
              {fromTransaction && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-2)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <label htmlFor="attach-count">Mensualités</label>
                  <Input
                    id="attach-count"
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    style={{ maxWidth: 80 }}
                  />
                  <span style={{ color: "var(--color-text-muted)" }}>
                    × {Math.abs(fromTransaction.amount).toFixed(2).replace(".", ",")} € dès{" "}
                    {fromTransaction.operationDate.slice(0, 7)}
                  </span>
                </div>
              )}
              <button
                type="button"
                style={{ ...optStyle, color: "var(--color-brand-primary-600)", fontWeight: "var(--fw-medium)" }}
                disabled={creating}
                onClick={createAndAttach}
              >
                <Plus size={14} aria-hidden />
                Créer «&nbsp;{query.trim()}&nbsp;»
              </button>
            </>
          )}
          {filtered.length === 0 && !query.trim() && (
            <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              Aucun achat. Tape un nom pour en créer un.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
