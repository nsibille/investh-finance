"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, type AccountInput } from "@/lib/accounts/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createAccount(input: AccountInput): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { bank, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    ...rest,
    bank: bank ? bank : null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

export async function updateAccount(
  id: string,
  input: AccountInput,
): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { bank, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ ...rest, bank: bank ? bank : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  return { ok: true };
}

export async function setAccountArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}
