"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import { matchRule } from "@/lib/rules/matcher";

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

export async function createRuleFromTransaction(
  input: RuleInput,
  options: { transactionId?: string; applyToPending?: boolean } = {},
): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("categorization_rules")
    .insert({
      ...parsed.data,
      created_from_transaction_id: options.transactionId ?? null,
    })
    .select("*")
    .single();
  if (error || !rule) return fail(error?.message ?? "Création impossible");

  if (options.applyToPending) {
    let q = supabase
      .from("transactions")
      .select("id, raw_label, amount, account_id")
      .eq("status", "pending");
    if (rule.account_id) q = q.eq("account_id", rule.account_id);
    const { data: pending } = await q;

    const matched = (pending ?? []).filter((t) => {
      if (rule.amount_min != null && Number(t.amount) < Number(rule.amount_min))
        return false;
      if (rule.amount_max != null && Number(t.amount) > Number(rule.amount_max))
        return false;
      return matchRule(rule, t.raw_label);
    });

    if (matched.length > 0) {
      const now = new Date().toISOString();
      await Promise.all(
        matched.map((t) =>
          supabase
            .from("transactions")
            .update({
              subcategory_id: rule.subcategory_id,
              applied_rule_id: rule.id,
              status: rule.auto_validate ? "validated" : "pending",
              validated_at: rule.auto_validate ? now : null,
            })
            .eq("id", t.id),
        ),
      );
      await supabase
        .from("categorization_rules")
        .update({ hit_count: rule.hit_count + matched.length, last_hit_at: now })
        .eq("id", rule.id);
    }
  }

  revalidate();
  revalidatePath("/rules");
  return { ok: true };
}
