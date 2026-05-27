"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import {
  applyRuleToTransactions,
  type RuleApplyScope,
} from "@/server/rules/apply";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type RuleSaveResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

/**
 * Creates or updates a rule, then optionally replays it over existing
 * transactions (`uncategorized` or `all`). Same apply semantics as creating a
 * rule from a transaction.
 */
export async function saveRule(
  input: RuleInput,
  options: { id?: string; applyScope?: RuleApplyScope } = {},
): Promise<RuleSaveResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };

  const supabase = await createClient();
  let ruleId = options.id;

  if (ruleId) {
    const { error } = await supabase
      .from("categorization_rules")
      .update(parsed.data)
      .eq("id", ruleId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("categorization_rules")
      .insert(parsed.data)
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "Création impossible" };
    ruleId = data.id;
  }

  let applied = 0;
  const scope = options.applyScope ?? "none";
  if (scope !== "none") {
    const { data: rule } = await supabase
      .from("categorization_rules")
      .select("*")
      .eq("id", ruleId)
      .single();
    if (rule) applied = await applyRuleToTransactions(supabase, rule, scope);
  }

  revalidatePath("/rules");
  revalidatePath("/transactions");
  return { ok: true, applied };
}

export async function setRuleActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/rules");
  return { ok: true };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/rules");
  return { ok: true };
}
