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
  const [busy, setBusy] = useState<string | null>(null);

  async function validate(row: TransactionRow) {
    setBusy(row.id);
    const res = await validateTransaction(row.id, selected[row.id] ?? null);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Validée");
    router.refresh();
  }

  async function ignore(row: TransactionRow) {
    setBusy(row.id);
    const res = await setTransactionStatus(row.id, "ignored");
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  if (rows.length === 0) {
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
        {rows.map((row) => (
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
              <Button size="sm" leftIcon={<Check size={14} />} loading={busy === row.id} onClick={() => validate(row)}>
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
