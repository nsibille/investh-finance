import type { createClient } from "@/lib/supabase/server";
import { matchRule, type MatchType } from "@/lib/rules/matcher";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Where a rule should be applied retroactively to existing transactions. */
export type RuleApplyScope = "none" | "uncategorized" | "all";

/** The rule fields needed to match and apply against transactions. */
export interface ApplicableRule {
  id: string;
  match_type: MatchType;
  pattern: string;
  case_sensitive: boolean;
  account_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  subcategory_id: string;
  auto_validate: boolean;
  hit_count: number;
}

/**
 * Applies a rule to existing transactions according to `scope` and returns the
 * number of transactions it touched. `none` is a no-op. Shared by rule creation
 * (from a transaction) and rule edition (replay).
 */
export async function applyRuleToTransactions(
  supabase: SupabaseServerClient,
  rule: ApplicableRule,
  scope: RuleApplyScope,
): Promise<number> {
  if (scope === "none") return 0;

  let q = supabase
    .from("transactions")
    .select("id, raw_label, amount, account_id");
  if (rule.account_id) q = q.eq("account_id", rule.account_id);
  if (scope === "uncategorized") q = q.is("subcategory_id", null);
  const { data: candidates } = await q;

  const matched = (candidates ?? []).filter((t) => {
    if (rule.amount_min != null && Number(t.amount) < Number(rule.amount_min))
      return false;
    if (rule.amount_max != null && Number(t.amount) > Number(rule.amount_max))
      return false;
    return matchRule(rule, t.raw_label);
  });

  if (matched.length === 0) return 0;

  const now = new Date().toISOString();
  // Never downgrade an already-validated transaction: only touch status when
  // the rule auto-validates.
  const statusPatch = rule.auto_validate
    ? { status: "validated" as const, validated_at: now }
    : {};
  await Promise.all(
    matched.map((t) =>
      supabase
        .from("transactions")
        .update({
          subcategory_id: rule.subcategory_id,
          applied_rule_id: rule.id,
          ...statusPatch,
        })
        .eq("id", t.id),
    ),
  );
  await supabase
    .from("categorization_rules")
    .update({ hit_count: rule.hit_count + matched.length, last_hit_at: now })
    .eq("id", rule.id);

  return matched.length;
}
