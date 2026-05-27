"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Check, Ban } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Dot } from "@/components/ui/Badge";
import { CategorySelect } from "./CategorySelect";
import { RuleSuggestionForm } from "./RuleSuggestionForm";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import {
  validateTransaction,
  setTransactionStatus,
} from "@/server/actions/transactions";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";

export function PendingValidator({
  rows,
  subcategoryOptions,
}: {
  rows: TransactionRow[];
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, string | null>>(
    Object.fromEntries(rows.map((r) => [r.id, r.subcategory_id])),
  );
  const [ruleFor, setRuleFor] = useState<TransactionRow | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function hide(id: string) {
    setHidden((h) => new Set(h).add(id));
  }
  function unhide(id: string) {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }

  async function validate(row: TransactionRow) {
    const subId = selected[row.id] ?? null;
    if (!subId) return toast.error("Choisis une catégorie avant de valider.");
    const res = await runOptimistic({
      apply: () => hide(row.id),
      rollback: () => unhide(row.id),
      run: () => validateTransaction(row.id, subId),
      onError: toast.error,
    });
    if (res.ok) {
      router.refresh();
      toast.success("Validée", {
        duration: 8000,
        action: { label: "Créer une règle", onClick: () => setRuleFor(row) },
      });
    }
  }

  async function ignore(row: TransactionRow) {
    const res = await runOptimistic({
      apply: () => hide(row.id),
      rollback: () => unhide(row.id),
      run: () => setTransactionStatus(row.id, "ignored"),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  const visibleRows = rows.filter((r) => !hidden.has(r.id));

  if (visibleRows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Check}
          title="Rien à valider"
          description="Toutes tes transactions sont catégorisées. Beau travail !"
        />
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {visibleRows.map((row) => (
          <div className="card-pending-validator" key={row.id}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: "var(--fw-medium)" }}>{row.label}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-1)" }}>
                  <span>{formatShortDate(row.operation_date)}</span>
                  {row.account && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                      <Dot color={row.account.color ?? undefined} />
                      {row.account.name}
                    </span>
                  )}
                </div>
              </div>
              <Amount value={row.amount} currency={row.currency} size="lg" />
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <CategorySelect
                  value={selected[row.id] ?? null}
                  options={subcategoryOptions}
                  onChange={(subId) => setSelected((s) => ({ ...s, [row.id]: subId }))}
                />
              </div>
              <Button size="sm" leftIcon={<Check size={14} />} onClick={() => validate(row)}>
                Valider
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Wand2 size={14} />} onClick={() => setRuleFor(row)}>
                Créer une règle
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Ban size={14} />} onClick={() => ignore(row)}>
                Ignorer
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={ruleFor !== null}
        onClose={() => setRuleFor(null)}
        title="Créer une règle depuis ce libellé"
        variantClass="modal-surface"
      >
        {ruleFor && (
          <RuleSuggestionForm
            transactionId={ruleFor.id}
            rawLabel={ruleFor.raw_label}
            accountId={ruleFor.account?.id ?? ""}
            defaultSubcategoryId={selected[ruleFor.id] ?? null}
            subcategoryOptions={subcategoryOptions}
            onDone={() => setRuleFor(null)}
          />
        )}
      </Modal>
    </>
  );
}
