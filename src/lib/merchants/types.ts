import type { Database } from "@/types/database.types";

export type Merchant = Database["public"]["Tables"]["merchants"]["Row"];

/** Règle rattachée à une enseigne (vue légère pour l'admin). */
export interface MerchantRule {
  id: string;
  name: string;
  match_type: Database["public"]["Enums"]["rule_match_type"];
  pattern: string;
  is_active: boolean;
  hit_count: number;
}

export interface MerchantWithDetails extends Merchant {
  categoryLabel: string | null;
  categoryColor: string | null;
  /** Transactions rattachées à l'enseigne. */
  transactionCount: number;
  /** Achats rattachés à l'enseigne. */
  purchaseCount: number;
  /** Règles rattachées (auto-rattachement à l'enseigne au match). */
  rules: MerchantRule[];
}

/** Options légères (id, nom, catégorie par défaut) pour l'autocomplétion. */
export interface MerchantOption {
  id: string;
  name: string;
  subcategoryId: string | null;
}
