"use server";

import { getTransactionsPage } from "@/lib/transactions/queries";
import type { TransactionFilters, TransactionStatus } from "@/lib/transactions/types";

export interface ExportRow {
  Date: string;
  Libellé: string;
  Compte: string;
  Catégorie: string;
  Montant: number;
  Devise: string;
  Statut: string;
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "À valider",
  validated: "Validée",
  ignored: "Ignorée",
};

export async function exportTransactions(
  filters: TransactionFilters,
): Promise<ExportRow[]> {
  const { rows } = await getTransactionsPage({ ...filters, page: 1, perPage: 10_000 });
  return rows.map((r) => ({
    Date: r.operation_date,
    Libellé: r.label,
    Compte: r.account?.name ?? "",
    Catégorie: r.category
      ? `${r.category.categoryName}${r.category.subcategoryName !== "—" ? ` / ${r.category.subcategoryName}` : ""}`
      : "",
    Montant: r.amount,
    Devise: r.currency,
    Statut: STATUS_LABELS[r.status],
  }));
}
