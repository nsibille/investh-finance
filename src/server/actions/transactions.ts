"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import { matchRule } from "@/lib/rules/matcher";
import {
  applyRuleToTransactions,
  type RuleApplyScope,
} from "@/server/rules/apply";

export type { RuleApplyScope };

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/pending");
  revalidatePath("/dashboard");
}

export async function setTransactionSubcategory(
  id: string,
  subcategoryId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  // Catégorie héritée d'un achat : non modifiable tant que la transaction y est
  // rattachée.
  const { data: tx } = await supabase
    .from("transactions")
    .select("purchase_id")
    .eq("id", id)
    .maybeSingle();
  if (tx?.purchase_id) {
    return fail("Catégorie héritée de l'achat — détache la transaction pour la changer.");
  }
  const { error } = await supabase
    .from("transactions")
    .update({ subcategory_id: subcategoryId })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function validateTransaction(
  id: string,
  subcategoryId: string | null,
): Promise<ActionResult> {
  if (!subcategoryId) return fail("Choisis une sous-catégorie avant de valider.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      subcategory_id: subcategoryId,
      status: "validated",
      validated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function setTransactionStatus(
  id: string,
  status: "pending" | "validated" | "ignored",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      status,
      validated_at: status === "validated" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function updateTransactionNote(
  id: string,
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ note: note.trim() || null })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath(`/transactions/${id}`);
  revalidate();
  return { ok: true };
}

export async function bulkValidate(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return fail("Aucune transaction sélectionnée");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .in("id", ids)
    .not("subcategory_id", "is", null);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/** Counts existing transactions whose raw label would match a candidate rule. */
export async function previewRuleMatches(input: {
  match_type?: "regex" | "contains" | "exact";
  pattern: string;
  case_sensitive?: boolean;
  account_id?: string;
}): Promise<number> {
  if (!input.pattern) return 0;
  const supabase = await createClient();
  let q = supabase.from("transactions").select("raw_label");
  if (input.account_id) q = q.eq("account_id", input.account_id);
  const { data } = await q;
  const rule = {
    match_type: input.match_type ?? "regex",
    pattern: input.pattern,
    case_sensitive: Boolean(input.case_sensitive),
  };
  return (data ?? []).filter((t) => matchRule(rule, t.raw_label)).length;
}

export type RuleCreateResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

export async function createRuleFromTransaction(
  input: RuleInput,
  options: { transactionId?: string; applyScope?: RuleApplyScope } = {},
): Promise<RuleCreateResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };

  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("categorization_rules")
    .insert({
      ...parsed.data,
      created_from_transaction_id: options.transactionId ?? null,
    })
    .select("*")
    .single();
  if (error || !rule)
    return { ok: false, error: error?.message ?? "Création impossible" };

  const applied = await applyRuleToTransactions(
    supabase,
    rule,
    options.applyScope ?? "none",
  );

  revalidate();
  revalidatePath("/rules");
  return { ok: true, applied };
}
