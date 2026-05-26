"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addTransactionTag(
  transactionId: string,
  tagId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction_tags")
    .insert({ transaction_id: transactionId, tag_id: tagId });
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

export async function removeTransactionTag(
  transactionId: string,
  tagId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", transactionId)
    .eq("tag_id", tagId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

/** Creates the tag if needed (by name) then attaches it to the transaction. */
export async function createAndAttachTag(
  transactionId: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Nom de tag vide" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();

  let tagId = existing?.id;
  if (!tagId) {
    const { data: created, error } = await supabase
      .from("tags")
      .insert({ name: trimmed })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "Création du tag impossible" };
    }
    tagId = created.id;
  }

  return addTransactionTag(transactionId, tagId);
}
