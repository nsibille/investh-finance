"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Check, Ban, Pencil } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { StatusBadge, Dot } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { CategorySelect } from "./CategorySelect";
import { useToast } from "@/hooks/useToast";
import { formatShortDate } from "@/lib/format/date";
import {
  setTransactionSubcategory,
  setTransactionStatus,
  validateTransaction,
} from "@/server/actions/transactions";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";

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

  function goToPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  async function changeCategory(id: string, subId: string | null) {
    const res = await setTransactionSubcategory(id, subId);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  async function quickValidate(row: TransactionRow) {
    const res = await validateTransaction(row.id, row.subcategory_id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Transaction validée");
    router.refresh();
  }

  async function ignore(id: string) {
    const res = await setTransactionStatus(id, "ignored");
    if (!res.ok) return toast.error(res.error);
    router.refresh();
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
            {rows.map((row) => (
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
                    value={row.subcategory_id}
                    options={subcategoryOptions}
                    onChange={(subId) => changeCategory(row.id, subId)}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Amount value={row.amount} currency={row.currency} />
                </td>
                <td><StatusBadge status={row.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                    {row.status === "pending" && (
                      <IconButton label="Valider" onClick={() => quickValidate(row)}>
                        <Check size={16} />
                      </IconButton>
                    )}
                    {row.status !== "ignored" && (
                      <IconButton label="Ignorer" onClick={() => ignore(row.id)}>
                        <Ban size={16} />
                      </IconButton>
                    )}
                    <Link href={`/transactions/${row.id}`}>
                      <IconButton label="Détails"><Pencil size={16} /></IconButton>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
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
    </>
  );
}
