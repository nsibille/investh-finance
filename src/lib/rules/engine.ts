import { matchRule, type MatchableRule } from "./matcher";
import type { Database } from "@/types/database.types";

/** Enseigne minimale dont un motif a besoin (catégorie + présence d'un nom). */
export interface EngineMerchant {
  name: string | null;
  subcategory_id: string | null;
}

export interface EngineRule extends MatchableRule {
  id: string;
  account_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  /** Enseigne propriétaire du motif (toujours présente désormais). */
  merchant_id: string;
  /** Catégorie par défaut de l'enseigne : source de vérité de la catégorie. */
  merchant_subcategory_id: string | null;
  /** L'enseigne porte un nom (vraie marque) → on la rattache à la transaction. */
  merchant_named: boolean;
  auto_validate: boolean;
  priority: number;
  is_active: boolean;
}

export interface EngineTransaction {
  account_id: string;
  amount: number;
  raw_label: string;
}

/**
 * Convertit une ligne `categorization_rules` + son enseigne en règle du moteur.
 * La catégorie et le rattachement viennent de l'enseigne, plus du motif.
 */
export function toEngineRule(
  r: Database["public"]["Tables"]["categorization_rules"]["Row"],
  merchant: EngineMerchant | null,
): EngineRule {
  return {
    id: r.id,
    match_type: r.match_type,
    pattern: r.pattern,
    case_sensitive: r.case_sensitive,
    account_id: r.account_id,
    amount_min: r.amount_min == null ? null : Number(r.amount_min),
    amount_max: r.amount_max == null ? null : Number(r.amount_max),
    merchant_id: r.merchant_id,
    merchant_subcategory_id: merchant?.subcategory_id ?? null,
    merchant_named: Boolean(merchant?.name && merchant.name.trim()),
    auto_validate: r.auto_validate,
    priority: r.priority,
    is_active: r.is_active,
  };
}

export interface RuleOutcome {
  subcategory_id: string | null;
  status: Database["public"]["Enums"]["transaction_status"];
  applied_rule_id: string | null;
  /** Enseigne rattachée : seulement si l'enseigne matchée porte un nom. */
  merchant_id: string | null;
}

/**
 * Applies the active rules to a transaction. Motifs of a NAMED enseigne (real
 * brand) win over motifs of a nameless enseigne (ex-simple rule); ties are then
 * broken by lowest `priority`. The category always comes from the matched
 * motif's enseigne; the enseigne is attached to the transaction only when it has
 * a name. Returns the first matching motif's outcome, otherwise a pending
 * fallback.
 */
export function applyRules(
  transaction: EngineTransaction,
  rules: EngineRule[],
): RuleOutcome {
  const ordered = rules
    .filter((r) => r.is_active)
    // Les enseignes NOMMÉES priment sur les enseignes sans nom (elles rattachent
    // la marque en plus de catégoriser). À rang égal, priorité croissante.
    .sort(
      (a, b) =>
        (a.merchant_named ? 0 : 1) - (b.merchant_named ? 0 : 1) ||
        a.priority - b.priority,
    );

  for (const rule of ordered) {
    if (rule.account_id && rule.account_id !== transaction.account_id) continue;
    if (rule.amount_min != null && transaction.amount < rule.amount_min) continue;
    if (rule.amount_max != null && transaction.amount > rule.amount_max) continue;

    if (matchRule(rule, transaction.raw_label)) {
      const categorized = rule.merchant_subcategory_id != null;
      return {
        subcategory_id: rule.merchant_subcategory_id,
        status: rule.auto_validate && categorized ? "validated" : "pending",
        applied_rule_id: rule.id,
        merchant_id: rule.merchant_named ? rule.merchant_id : null,
      };
    }
  }

  return {
    subcategory_id: null,
    status: "pending",
    applied_rule_id: null,
    merchant_id: null,
  };
}
