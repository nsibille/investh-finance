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
  const { bank, connection_name, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    ...rest,
    bank: bank ? bank : null,
    connection_name: connection_name ? connection_name : null,
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
  const { bank, connection_name, ...rest } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      ...rest,
      bank: bank ? bank : null,
      connection_name: connection_name ? connection_name : null,
    })
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

/**
 * Ajoute un rebasement : ancre le solde réel du compte à une date. Le solde
 * courant repart ensuite de cette valeur + les transactions validées
 * postérieures. Plusieurs rebasements peuvent coexister dans le temps.
 */
export async function addAccountRebase(
  accountId: string,
  input: { rebaseDate: string; balance: number; note?: string | null },
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.rebaseDate))
    return { ok: false, error: "Date de rebasement invalide" };
  if (!Number.isFinite(input.balance))
    return { ok: false, error: "Solde invalide" };

  const supabase = await createClient();
  const { error } = await supabase.from("account_rebases").insert({
    account_id: accountId,
    rebase_date: input.rebaseDate,
    balance: input.balance,
    note: input.note?.trim() ? input.note.trim() : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAccountRebase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("account_rebases").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { ok: true };
}
