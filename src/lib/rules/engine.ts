import { matchRule, type MatchableRule } from "./matcher";
import type { Database } from "@/types/database.types";

export interface EngineRule extends MatchableRule {
  id: string;
  account_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  subcategory_id: string;
  auto_validate: boolean;
  priority: number;
  is_active: boolean;
}

export interface EngineTransaction {
  account_id: string;
  amount: number;
  raw_label: string;
}

/** Convertit une ligne `categorization_rules` en règle du moteur. */
export function toEngineRule(
  r: Database["public"]["Tables"]["categorization_rules"]["Row"],
): EngineRule {
  return {
    id: r.id,
    match_type: r.match_type,
    pattern: r.pattern,
    case_sensitive: r.case_sensitive,
    account_id: r.account_id,
    amount_min: r.amount_min == null ? null : Number(r.amount_min),
    amount_max: r.amount_max == null ? null : Number(r.amount_max),
    subcategory_id: r.subcategory_id,
    auto_validate: r.auto_validate,
    priority: r.priority,
    is_active: r.is_active,
  };
}

export interface RuleOutcome {
  subcategory_id: string | null;
  status: Database["public"]["Enums"]["transaction_status"];
  applied_rule_id: string | null;
}

/**
 * Applies the active rules to a transaction, lowest `priority` first.
 * Returns the first matching rule's outcome, otherwise a pending fallback.
 */
export function applyRules(
  transaction: EngineTransaction,
  rules: EngineRule[],
): RuleOutcome {
  const ordered = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of ordered) {
    if (rule.account_id && rule.account_id !== transaction.account_id) continue;
    if (rule.amount_min != null && transaction.amount < rule.amount_min) continue;
    if (rule.amount_max != null && transaction.amount > rule.amount_max) continue;

    if (matchRule(rule, transaction.raw_label)) {
      return {
        subcategory_id: rule.subcategory_id,
        status: rule.auto_validate ? "validated" : "pending",
        applied_rule_id: rule.id,
      };
    }
  }

  return { subcategory_id: null, status: "pending", applied_rule_id: null };
}
