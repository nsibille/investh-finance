"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInstallments } from "@/lib/purchases/installments";
import { matchPurchaseInstallments } from "@/lib/purchases/match";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";
import type { Database } from "@/types/database.types";

type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export interface InstallmentPlan {
  count: number;
  startMonth: string; // YYYY-MM ou YYYY-MM-DD
  amount: number;
  label?: string | null;
}

export interface RecurrencePlan {
  amount: number;
  startMonth: string; // YYYY-MM ou YYYY-MM-DD
  /** Mois de fin (YYYY-MM) ; null/undefined = sans fin (abonnement). */
  endMonth?: string | null;
  label?: string | null;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/achats");
  revalidatePath("/transactions");
}

export interface PurchaseInput {
  name: string;
  description?: string | null;
  subcategoryId?: string | null;
  /** Enseigne rattachée (sa catégorie sert de défaut, surchargeable). */
  merchantId?: string | null;
  /** Plan de mensualités (optionnel : achat direct si absent ou count = 0). */
  installmentPlan?: InstallmentPlan | null;
  /** Plan récurrent (abonnement/loyer). Exclusif de `installmentPlan`. */
  recurrencePlan?: RecurrencePlan | null;
}

function toMonthDate(ym: string): string {
  return `${ym.slice(0, 7)}-01`;
}

export async function createPurchase(input: PurchaseInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const rec = input.recurrencePlan;
  const isRecurring = Boolean(
    rec && rec.startMonth && Number.isFinite(rec.amount),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      name,
      description: input.description?.trim() || null,
      subcategory_id: input.subcategoryId ?? null,
      merchant_id: input.merchantId ?? null,
      is_recurring: isRecurring,
      recurrence_amount: isRecurring ? rec!.amount : null,
      recurrence_start: isRecurring ? toMonthDate(rec!.startMonth) : null,
      recurrence_end: isRecurring && rec!.endMonth ? toMonthDate(rec!.endMonth) : null,
      recurrence_label: isRecurring ? (rec!.label ?? null) : null,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Création impossible");

  if (isRecurring) {
    // Génère les échéances (jusqu'à la fin, ou horizon glissant si sans fin).
    await ensureRecurringInstallments();
    // Apparie sur mois + montant aux transactions existantes.
    await matchPurchaseInstallments(data.id);
  }

  const plan = input.installmentPlan;
  if (
    !isRecurring &&
    plan &&
    plan.count > 0 &&
    plan.startMonth &&
    Number.isFinite(plan.amount)
  ) {
    const rows = generateInstallments(plan).map((i) => ({
      purchase_id: data.id,
      month: i.month,
      amount: i.amount,
      label: i.label,
    }));
    if (rows.length > 0) {
      await supabase.from("purchase_installments").insert(rows);
      // Achat créé sans transaction (pas de libellé de référence) : on apparie
      // les mensualités aux transactions existantes sur mois + montant.
      if (!plan.label) await matchPurchaseInstallments(data.id);
    }
  }

  revalidate();
  return { ok: true, id: data.id };
}

export async function setPurchaseArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchases")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
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
      merchant_id: input.merchantId ?? null,
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
  // Apparie immédiatement la mensualité à une transaction existante si possible.
  await matchPurchaseInstallments(purchaseId);
  revalidatePath("/achats");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function deleteInstallment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_installments").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/achats");
  return { ok: true };
}
