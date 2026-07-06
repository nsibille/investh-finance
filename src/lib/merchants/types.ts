import type { Database } from "@/types/database.types";

export type Merchant = Database["public"]["Tables"]["merchants"]["Row"];

/** Motif rattaché à une enseigne (vue pour l'admin, incluant les champs avancés). */
export interface MerchantRule {
  id: string;
  name: string;
  match_type: Database["public"]["Enums"]["rule_match_type"];
  pattern: string;
  case_sensitive: boolean;
  is_active: boolean;
  hit_count: number;
  account_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  priority: number;
  auto_validate: boolean;
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
