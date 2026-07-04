import type { Database } from "@/types/database.types";

export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
export type PurchaseInstallment =
  Database["public"]["Tables"]["purchase_installments"]["Row"];

export interface PurchaseWithDetails extends Purchase {
  categoryLabel: string | null;
  categoryColor: string | null;
  /** Nombre de transactions rattachées. */
  transactionCount: number;
  /** Somme des transactions rattachées (réalisé). */
  paidAmount: number;
  installments: PurchaseInstallment[];
  /** Somme des mensualités prévisionnelles. */
  forecastAmount: number;
}

export interface PurchaseOption {
  id: string;
  name: string;
  subcategoryId: string | null;
}
