"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Check, Ban, Pencil } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { StatusBadge, Dot } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CategorySelect } from "./CategorySelect";
import { RuleSuggestionForm } from "./RuleSuggestionForm";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import {
  setTransactionSubcategory,
  setTransactionStatus,
  validateTransaction,
} from "@/server/actions/transactions";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";

type RowOverride = Partial<Pick<TransactionRow, "subcategory_id" | "status">>;

export function TransactionsTable({
  rows,
  total,
  page,
  perPage,
  subcategoryOptions,
}: {
  rows: TransactionRow[];
  total: number;
  page: number;
  perPage: number;
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [ruleFor, setRuleFor] = useState<TransactionRow | null>(null);

  function merged(row: TransactionRow): TransactionRow {
    const o = overrides[row.id];
    return o ? { ...row, ...o } : row;
  }

  function patch(id: string, p: RowOverride) {
    setOverrides((m) => ({ ...m, [id]: { ...m[id], ...p } }));
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  async function changeCategory(row: TransactionRow, subId: string | null) {
    const prev = merged(row).subcategory_id;
    const res = await runOptimistic({
      apply: () => patch(row.id, { subcategory_id: subId }),
      rollback: () => patch(row.id, { subcategory_id: prev }),
      run: () => setTransactionSubcategory(row.id, subId),
      onError: toast.error,
    });
    if (res.ok) {
      router.refresh();
      if (subId) {
        toast.info("Catégorie mise à jour", {
          duration: 8000,
          action: {
            label: "Créer une règle",
            onClick: () => setRuleFor({ ...row, subcategory_id: subId }),
          },
        });
      }
    }
  }

  async function quickValidate(row: TransactionRow) {
    const current = merged(row);
    if (!current.subcategory_id) {
      return toast.error("Choisis une catégorie avant de valider.");
    }
    const prev = current.status;
    const res = await runOptimistic({
      apply: () => patch(row.id, { status: "validated" }),
      rollback: () => patch(row.id, { status: prev }),
      run: () => validateTransaction(row.id, current.subcategory_id),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Transaction validée");
      router.refresh();
    }
  }

  async function ignore(row: TransactionRow) {
    const prev = merged(row).status;
    const res = await runOptimistic({
      apply: () => patch(row.id, { status: "ignored" }),
      rollback: () => patch(row.id, { status: prev }),
      run: () => setTransactionStatus(row.id, "ignored"),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="table-transactions">
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th>Compte</th>
              <th>Catégorie</th>
              <th style={{ textAlign: "right" }}>Montant</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const r = merged(row);
              return (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(row.operation_date)}</td>
                <td style={{ maxWidth: 320 }}>
                  <Link
                    href={`/transactions/${row.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {row.label}
                  </Link>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {row.account && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Dot color={row.account.color ?? undefined} />
                      {row.account.name}
                    </span>
                  )}
                </td>
                <td style={{ minWidth: 200 }}>
                  <CategorySelect
                    value={r.subcategory_id}
                    options={subcategoryOptions}
                    onChange={(subId) => changeCategory(row, subId)}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Amount value={row.amount} currency={row.currency} />
                </td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                    {r.status === "pending" && (
                      <IconButton label="Valider" onClick={() => quickValidate(row)}>
                        <Check size={16} />
                      </IconButton>
                    )}
                    {r.status !== "ignored" && (
                      <IconButton label="Ignorer" onClick={() => ignore(row)}>
                        <Ban size={16} />
                      </IconButton>
                    )}
                    <Link href={`/transactions/${row.id}`}>
                      <IconButton label="Détails"><Pencil size={16} /></IconButton>
                    </Link>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-4)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          {total} transaction{total > 1 ? "s" : ""} · page {page}/{totalPages}
        </span>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            Précédent
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            Suivant
          </Button>
        </div>
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
            defaultSubcategoryId={ruleFor.subcategory_id}
            subcategoryOptions={subcategoryOptions}
            onDone={() => setRuleFor(null)}
          />
        )}
      </Modal>
    </>
  );
}
