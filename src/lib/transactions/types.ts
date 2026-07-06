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
  purchase?: {
    id: string;
    name: string;
    /** Occurrence 1-based de la mensualité et total (affiché « X/Y »). */
    occurrence?: number | null;
    installmentTotal?: number | null;
    /** Abonnement sans fin (occurrence X/∞). */
    endless?: boolean;
  } | null;
  /** Enseigne rattachée (catégorie par défaut appliquée, surchargeable). */
  merchant?: { id: string; name: string } | null;
  /** Récurrente rattachée. */
  recurring?: { id: string; name: string } | null;
  /** Résumé léger du partage entre personnes (nb + nature) pour la liste. */
  personsSummary?: {
    count: number;
    nature: Database["public"]["Enums"]["split_nature"];
  } | null;
  /**
   * Ventilation complète (nature + parts) pour pré-remplir l'éditeur de partage
   * depuis la liste. `null` quand la transaction n'est pas ventilée.
   */
  split?: import("@/lib/persons/types").TransactionSplit | null;
  /**
   * Remboursement lié (crédit marqué « remboursement d'une dette ») : nom de la
   * personne remboursée. `null` quand la transaction n'est pas un remboursement.
   */
  repayment?: { personName: string } | null;
}

export interface TransactionFilters {
  accountId?: string;
  status?: TransactionStatus;
  subcategoryId?: string;
  /** Enseignes (OR) : la transaction doit être rattachée à l'une d'elles. */
  merchantIds?: string[];
  /** Achats (OR) : la transaction doit être rattachée à l'un d'eux. */
  purchaseIds?: string[];
  /** Bornes de montant en valeur absolue (dépense ou revenu). */
  amountMin?: number;
  amountMax?: number;
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
