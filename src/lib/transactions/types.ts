import type { Database } from "@/types/database.types";

export type Transaction =
  Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionStatus =
  Database["public"]["Enums"]["transaction_status"];

export interface CategoryDisplay {
  subcategory_id: string;
  subcategoryName: string;
  categoryName: string;
  typeName: string;
  color: string | null;
  isIncome: boolean;
}

export interface AccountDisplay {
  id: string;
  name: string;
  color: string | null;
  type: Database["public"]["Enums"]["account_type"];
}

export interface TransactionRow {
  id: string;
  operation_date: string;
  value_date: string | null;
  label: string;
  raw_label: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  note: string | null;
  is_recurring: boolean;
  subcategory_id: string | null;
  account: AccountDisplay | null;
  category: CategoryDisplay | null;
  /** Achat rattaché (catégorie héritée, verrou sur le sélecteur). */
  purchase?: { id: string; name: string } | null;
  /** Enseigne rattachée (catégorie par défaut appliquée, surchargeable). */
  merchant?: { id: string; name: string } | null;
}

export interface TransactionFilters {
  accountId?: string;
  status?: TransactionStatus;
  subcategoryId?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  page?: number;
  perPage?: number;
}

export interface TransactionsPage {
  rows: TransactionRow[];
  total: number;
  page: number;
  perPage: number;
}
