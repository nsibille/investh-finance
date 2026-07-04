"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/purchases");
  revalidatePath("/transactions");
}

export interface PurchaseInput {
  name: string;
  description?: string | null;
  subcategoryId?: string | null;
}

export async function createPurchase(input: PurchaseInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      name,
      description: input.description?.trim() || null,
      subcategory_id: input.subcategoryId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Création impossible");
  revalidate();
  return { ok: true, id: data.id };
}

export async function updatePurchase(
  id: string,
  input: PurchaseInput,
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const subcategoryId = input.subcategoryId ?? null;
  const { error } = await supabase
    .from("purchases")
    .update({
      name,
      description: input.description?.trim() || null,
      subcategory_id: subcategoryId,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  // La catégorie de l'achat est héritée : on la propage aux transactions liées.
  await supabase
    .from("transactions")
    .update({ subcategory_id: subcategoryId })
    .eq("purchase_id", id);

  revalidate();
  return { ok: true };
}

export async function deletePurchase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // transactions.purchase_id passe à NULL (ON DELETE SET NULL) ; les
  // mensualités sont supprimées en cascade.
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/** Rattache une transaction à un achat : la catégorie de l'achat est héritée. */
export async function attachTransactionToPurchase(
  transactionId: string,
  purchaseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: purchase } = await supabase
    .from("purchases")
    .select("subcategory_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return fail("Achat introuvable");

  const patch: TransactionUpdate = { purchase_id: purchaseId };
  if (purchase.subcategory_id) {
    patch.subcategory_id = purchase.subcategory_id;
    patch.status = "validated";
    patch.validated_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", transactionId);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function detachTransaction(transactionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ purchase_id: null })
    .eq("id", transactionId);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function addInstallment(
  purchaseId: string,
  month: string,
  amount: number,
  note?: string,
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) return fail("Mois invalide");
  if (!Number.isFinite(amount)) return fail("Montant invalide");
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_installments").insert({
    purchase_id: purchaseId,
    month,
    amount,
    note: note?.trim() || null,
  });
  if (error) return fail(error.message);
  revalidatePath("/purchases");
  return { ok: true };
}

export async function deleteInstallment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_installments").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/purchases");
  return { ok: true };
}
