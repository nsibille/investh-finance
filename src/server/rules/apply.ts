import type { createClient } from "@/lib/supabase/server";
import { matchRule, type MatchType } from "@/lib/rules/matcher";
import type { Database } from "@/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type RuleRow = Database["public"]["Tables"]["categorization_rules"]["Row"];

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
  /** Enseigne propriétaire du motif (toujours présente). */
  merchant_id: string;
  /** Catégorie par défaut de l'enseigne : source de vérité de la catégorie. */
  merchant_subcategory_id: string | null;
  /** L'enseigne porte un nom → on la rattache aux transactions matchées. */
  merchant_named: boolean;
  auto_validate: boolean;
  hit_count: number;
}

/** Enseigne minimale (nom + catégorie) nécessaire pour appliquer un motif. */
export interface ApplyMerchant {
  name: string | null;
  subcategory_id: string | null;
}

/** Assemble une `ApplicableRule` depuis une ligne motif et son enseigne. */
export function toApplicableRule(
  r: RuleRow,
  merchant: ApplyMerchant | null,
): ApplicableRule {
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
    hit_count: r.hit_count,
  };
}

/** Charge un motif par son id, joint à son enseigne, prêt pour l'application. */
export async function loadApplicableRule(
  supabase: SupabaseServerClient,
  ruleId: string,
): Promise<ApplicableRule | null> {
  const { data: rule } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) return null;
  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, subcategory_id")
    .eq("id", rule.merchant_id)
    .maybeSingle();
  return toApplicableRule(rule, merchant ?? null);
}

/**
 * Applies a rule to existing transactions according to `scope` and returns the
 * number of transactions it touched. `none` is a no-op. Shared by rule creation
 * (from a transaction) and rule edition (replay). La catégorie appliquée vient de
 * l'enseigne du motif ; l'enseigne n'est rattachée que si elle porte un nom.
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

  const categorized = rule.merchant_subcategory_id != null;
  const now = new Date().toISOString();
  // Never downgrade an already-validated transaction: only touch status when the
  // rule auto-validates AND actually categorizes (enseigne avec catégorie).
  const statusPatch =
    rule.auto_validate && categorized
      ? { status: "validated" as const, validated_at: now }
      : {};
  await Promise.all(
    matched.map((t) =>
      supabase
        .from("transactions")
        .update({
          // Catégorie héritée de l'enseigne (si elle en a une).
          ...(categorized
            ? { subcategory_id: rule.merchant_subcategory_id }
            : {}),
          applied_rule_id: rule.id,
          // Rattache l'enseigne uniquement si c'est une vraie marque (nommée).
          ...(rule.merchant_named ? { merchant_id: rule.merchant_id } : {}),
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
