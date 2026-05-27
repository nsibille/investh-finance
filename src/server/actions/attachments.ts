"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addAttachment(
  transactionId: string,
  meta: {
    storage_path: string;
    filename: string;
    mime_type: string | null;
    size_bytes: number | null;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    transaction_id: transactionId,
    storage_path: meta.storage_path,
    filename: meta.filename,
    mime_type: meta.mime_type,
    size_bytes: meta.size_bytes,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

export async function deleteAttachment(
  id: string,
  transactionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (row?.storage_path) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([row.storage_path]);
  }
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}
