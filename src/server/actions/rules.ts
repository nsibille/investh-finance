"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

export async function createRule(input: RuleInput): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { error } = await supabase.from("categorization_rules").insert(parsed.data);
  if (error) return fail(error.message);
  revalidatePath("/rules");
  return { ok: true };
}

export async function updateRule(
  id: string,
  input: RuleInput,
): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .update(parsed.data)
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/rules");
  return { ok: true };
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
