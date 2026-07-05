"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInstallments } from "@/lib/purchases/installments";
import { matchPurchaseInstallments } from "@/lib/purchases/match";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";
import { isValidParent, type PurchaseEdge } from "@/lib/purchases/tree";
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
  revalidatePath("/transactions/pending");
}

export interface PurchaseInput {
  name: string;
  description?: string | null;
  subcategoryId?: string | null;
  /** Enseigne rattachée (sa catégorie sert de défaut, surchargeable). */
  merchantId?: string | null;
  /** Achat parent (groupe). null = achat racine. */
  parentId?: string | null;
  /** Plan de mensualités (optionnel : achat direct si absent ou count = 0). */
  installmentPlan?: InstallmentPlan | null;
  /** Plan récurrent (abonnement/loyer). Exclusif de `installmentPlan`. */
  recurrencePlan?: RecurrencePlan | null;
}

function toMonthDate(ym: string): string {
  return `${ym.slice(0, 7)}-01`;
}

/** Charge toutes les arêtes parent→enfant (pour valider un rattachement). */
async function loadPurchaseEdges(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PurchaseEdge[]> {
  const { data } = await supabase.from("purchases").select("id, parent_id");
  return (data ?? []).map((p) => ({ id: p.id, parentId: p.parent_id }));
}

export async function createPurchase(input: PurchaseInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const rec = input.recurrencePlan;
  const isRecurring = Boolean(
    rec && rec.startMonth && Number.isFinite(rec.amount),
  );

  const supabase = await createClient();
  // Un achat parent inexistant est simplement ignoré (rattachement à la racine) ;
  // un nouvel achat n'a pas encore de descendant, donc pas de risque de cycle.
  const parentId = input.parentId ?? null;
  const { data, error } = await supabase
    .from("purchases")
    .insert({
      name,
      description: input.description?.trim() || null,
      subcategory_id: input.subcategoryId ?? null,
      merchant_id: input.merchantId ?? null,
      parent_id: parentId,
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

  const patch: Database["public"]["Tables"]["purchases"]["Update"] = {
    name,
    description: input.description?.trim() || null,
    subcategory_id: subcategoryId,
    merchant_id: input.merchantId ?? null,
  };
  // parent_id n'est mis à jour que s'il est explicitement fourni.
  if (input.parentId !== undefined) {
    const parentId = input.parentId;
    if (parentId !== null) {
      const edges = await loadPurchaseEdges(supabase);
      if (!isValidParent(id, parentId, edges)) {
        return fail(
          "Rattachement impossible : un achat ne peut pas se référencer lui-même ni créer une boucle.",
        );
      }
    }
    patch.parent_id = parentId;
  }

  const { error } = await supabase.from("purchases").update(patch).eq("id", id);
  if (error) return fail(error.message);

  // La catégorie de l'achat est héritée : on la propage aux transactions liées.
  await supabase
    .from("transactions")
    .update({ subcategory_id: subcategoryId })
    .eq("purchase_id", id);

  revalidate();
  return { ok: true };
}

/**
 * Rattache un achat à un groupe parent (ou le détache si `parentId` est null).
 * Refuse l'auto-référence et toute référence circulaire (double garde-fou avec
 * le trigger SQL). Utilisé par le glisser dans/hors d'un groupe.
 */
export async function setPurchaseParent(
  id: string,
  parentId: string | null,
): Promise<ActionResult> {
  if (parentId === id) return fail("Un achat ne peut pas se référencer lui-même.");
  const supabase = await createClient();
  if (parentId !== null) {
    const edges = await loadPurchaseEdges(supabase);
    if (!isValidParent(id, parentId, edges)) {
      return fail(
        "Rattachement impossible : cela créerait une référence circulaire.",
      );
    }
  }
  const { error } = await supabase
    .from("purchases")
    .update({ parent_id: parentId })
    .eq("id", id);
  if (error) return fail(error.message);
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
  // Appariement automatique : remplit une échéance prévisionnelle non appariée
  // si le mois + le montant correspondent (comportement « auto »).
  await matchPurchaseInstallments(purchaseId);
  revalidate();
  return { ok: true };
}

/**
 * Rattache une transaction à un achat en remplissant une échéance
 * prévisionnelle précise (« transaction non matchée » de l'achat). L'échéance
 * adopte le montant réel de la transaction ; la catégorie de l'achat est héritée.
 */
export async function attachTransactionToInstallment(
  transactionId: string,
  installmentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from("purchase_installments")
    .select("id, purchase_id, transaction_id")
    .eq("id", installmentId)
    .maybeSingle();
  if (!inst) return fail("Échéance introuvable");
  if (inst.transaction_id) return fail("Cette échéance est déjà appariée.");

  const { data: tx } = await supabase
    .from("transactions")
    .select("amount")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return fail("Transaction introuvable");

  const { data: purchase } = await supabase
    .from("purchases")
    .select("subcategory_id")
    .eq("id", inst.purchase_id)
    .maybeSingle();
  if (!purchase) return fail("Achat introuvable");

  // L'échéance adopte le montant réellement constaté et pointe la transaction.
  const { error: instErr } = await supabase
    .from("purchase_installments")
    .update({ transaction_id: transactionId, amount: Number(tx.amount) })
    .eq("id", installmentId);
  if (instErr) return fail(instErr.message);

  const patch: TransactionUpdate = { purchase_id: inst.purchase_id };
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

/**
 * Crée une nouvelle échéance dans un achat à partir d'une transaction (mois +
 * montant de l'opération) puis la lui apparie. La catégorie de l'achat est
 * héritée par la transaction.
 */
export async function createInstallmentForTransaction(
  transactionId: string,
  purchaseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("amount, operation_date")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return fail("Transaction introuvable");

  const { data: purchase } = await supabase
    .from("purchases")
    .select("subcategory_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return fail("Achat introuvable");

  const month = `${tx.operation_date.slice(0, 7)}-01`;
  const { error: instErr } = await supabase.from("purchase_installments").insert({
    purchase_id: purchaseId,
    month,
    amount: Number(tx.amount),
    transaction_id: transactionId,
  });
  if (instErr) return fail(instErr.message);

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
