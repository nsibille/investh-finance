"use client";

import { useMemo, useState } from "react";
import { Plus, ChevronLeft, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Amount } from "@/components/ui/Amount";
import { useToast } from "@/hooks/useToast";
import { createPurchase } from "@/server/actions/purchases";
import { generateInstallments } from "@/lib/purchases/installments";
import { formatMonthLabel } from "@/lib/format/date";
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";

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

function hoverable(node: React.CSSProperties = {}): {
  style: React.CSSProperties;
  onMouseEnter: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave: React.MouseEventHandler<HTMLButtonElement>;
} {
  return {
    style: { ...optStyle, ...node },
    onMouseEnter: (e) => (e.currentTarget.style.background = "var(--color-bg-subtle)"),
    onMouseLeave: (e) => (e.currentTarget.style.background = "transparent"),
  };
}

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
  onAttach: (option: PurchaseOption, choice: InstallmentChoice) => void;
  /** Si fourni, la création propose un plan de mensualités pré-rempli. */
  fromTransaction?: FromTransaction | null;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // Nombre de mensualités quand on crée depuis une transaction (1 = direct).
  const [count, setCount] = useState("1");
  // Étape 2 : achat sélectionné dont on choisit l'échéance à remplir.
  const [selected, setSelected] = useState<PurchaseOption | null>(null);

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
    setSelected(null);
  }

  function attach(option: PurchaseOption, choice: InstallmentChoice) {
    onAttach(option, choice);
    reset();
    onClose();
  }

  // Clic sur un achat existant : achat à échéancier → on choisit l'échéance ;
  // achat direct (sans mensualité) → rattachement simple immédiat.
  function pick(option: PurchaseOption) {
    if (option.installmentMonths.length > 0) {
      setSelected(option);
    } else {
      attach(option, { mode: "auto" });
    }
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
    const installmentMonths = installmentPlan
      ? generateInstallments({
          startMonth: installmentPlan.startMonth,
          count: installmentPlan.count,
          amount: installmentPlan.amount,
        }).map((i) => i.month)
      : [];
    attach(
      {
        id: res.id,
        name,
        subcategoryId: null,
        merchantId: null,
        merchantName: null,
        installmentMonths,
        unmatchedInstallments: [],
        endless: false,
      },
      { mode: "auto" },
    );
  }

  const txAmountLabel = fromTransaction
    ? Math.abs(fromTransaction.amount).toFixed(2).replace(".", ",")
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selected ? "Choisir l'échéance à remplir" : "Rattacher à un achat"}
    >
      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, font: "inherit", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", cursor: "pointer" }}
          >
            <ChevronLeft size={14} aria-hidden />
            {selected.name}
          </button>

          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {selected.unmatchedInstallments.length > 0 && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", padding: "var(--space-1) var(--space-2)" }}>
                Échéances non appariées
              </div>
            )}
            {selected.unmatchedInstallments.map((inst) => (
              <button
                key={inst.id}
                type="button"
                {...hoverable()}
                onClick={() =>
                  attach(selected, {
                    mode: "existing",
                    installmentId: inst.id,
                    month: inst.month,
                    amount: inst.amount,
                  })
                }
              >
                <span style={{ flex: 1, textTransform: "capitalize" }}>
                  {formatMonthLabel(inst.month)}
                </span>
                <Amount value={Number(inst.amount)} size="sm" tone="neutral" />
              </button>
            ))}

            <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "var(--space-1)", paddingTop: "var(--space-1)" }} />

            <button
              type="button"
              {...hoverable({ color: "var(--color-brand-primary-600)", fontWeight: "var(--fw-medium)" })}
              onClick={() => attach(selected, { mode: "create" })}
            >
              <Plus size={14} aria-hidden />
              Créer une nouvelle échéance
              {fromTransaction && (
                <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--fw-regular)" }}>
                  {" "}({fromTransaction.operationDate.slice(0, 7)} · {txAmountLabel} €)
                </span>
              )}
            </button>

            <button
              type="button"
              {...hoverable({ color: "var(--color-text-secondary)" })}
              onClick={() => attach(selected, { mode: "auto" })}
            >
              <Sparkles size={14} aria-hidden />
              Rattacher sans échéance (appariement auto)
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou créer un achat…"
          />
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((p) => (
              <button key={p.id} type="button" {...hoverable()} onClick={() => pick(p)}>
                <span style={{ flex: 1 }}>{p.name}</span>
                {p.unmatchedInstallments.length > 0 && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {p.unmatchedInstallments.length} à venir
                  </span>
                )}
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
                      × {txAmountLabel} € dès {fromTransaction.operationDate.slice(0, 7)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  {...hoverable({ color: "var(--color-brand-primary-600)", fontWeight: "var(--fw-medium)" })}
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
      )}
    </Modal>
  );
}
