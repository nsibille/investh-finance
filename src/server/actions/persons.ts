"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SplitNature } from "@/lib/persons/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/personnes");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

// ---------------------------------------------------------------------------
// CRUD personnes
// ---------------------------------------------------------------------------

export interface PersonInput {
  name: string;
  color?: string | null;
}

export async function createPerson(input: PersonInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("persons")
    .insert({ name, color: input.color?.trim() || undefined })
    .select("id")
    .single();

  // Nom déjà pris (index unique lower(name)) : renvoie la personne existante
  // pour que la création « à la volée » reste idempotente.
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("persons")
        .select("id")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      if (existing) return { ok: true, id: existing.id };
    }
    return fail(error.message);
  }
  if (!data) return fail("Création impossible");
  revalidate();
  return { ok: true, id: data.id };
}

export async function updatePerson(
  id: string,
  input: PersonInput & { isArchived?: boolean },
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const { error } = await supabase
    .from("persons")
    .update({
      name,
      color: input.color?.trim() || undefined,
      ...(input.isArchived !== undefined ? { is_archived: input.isArchived } : {}),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return fail("Une personne porte déjà ce nom.");
    return fail(error.message);
  }
  revalidate();
  return { ok: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("is_self")
    .eq("id", id)
    .maybeSingle();
  if (!person) return fail("Personne introuvable");
  if (person.is_self) return fail("Impossible de supprimer « moi ».");
  // transaction_persons + person_repayments → ON DELETE CASCADE.
  const { error } = await supabase.from("persons").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ventilation d'une transaction
// ---------------------------------------------------------------------------

export interface ShareInput {
  personId: string;
  amount: number;
}

/**
 * Remplace intégralement la ventilation d'une transaction : fixe la nature
 * globale (`debt`/`gift`) et réécrit les parts. Une liste vide efface la
 * ventilation (nature → NULL, parts supprimées).
 */
export async function setTransactionShares(
  transactionId: string,
  input: { nature: SplitNature; shares: ShareInput[] },
): Promise<ActionResult> {
  const supabase = await createClient();

  const cleaned = input.shares
    .filter((s) => s.personId && Number.isFinite(s.amount))
    .map((s) => ({
      transaction_id: transactionId,
      person_id: s.personId,
      share_amount: Math.max(0, Math.round(Math.abs(s.amount) * 100) / 100),
    }));

  // On repart d'une table propre pour éviter les orphelins de parts.
  const { error: delErr } = await supabase
    .from("transaction_persons")
    .delete()
    .eq("transaction_id", transactionId);
  if (delErr) return fail(delErr.message);

  if (cleaned.length === 0) {
    const { error: natErr } = await supabase
      .from("transactions")
      .update({ split_nature: null })
      .eq("id", transactionId);
    if (natErr) return fail(natErr.message);
    revalidate();
    revalidatePath(`/transactions/${transactionId}`);
    return { ok: true };
  }

  const { error: insErr } = await supabase
    .from("transaction_persons")
    .insert(cleaned);
  if (insErr) return fail(insErr.message);

  const { error: natErr } = await supabase
    .from("transactions")
    .update({ split_nature: input.nature })
    .eq("id", transactionId);
  if (natErr) return fail(natErr.message);

  revalidate();
  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}

export async function clearTransactionShares(
  transactionId: string,
): Promise<ActionResult> {
  return setTransactionShares(transactionId, { nature: "debt", shares: [] });
}

// ---------------------------------------------------------------------------
// Remboursements
// ---------------------------------------------------------------------------

export interface RepaymentInput {
  personId: string;
  amount: number;
  repaidOn?: string | null;
  transactionId?: string | null;
  note?: string | null;
}

export async function addRepayment(
  input: RepaymentInput,
): Promise<ActionResult> {
  const amount = Math.round(Math.abs(input.amount) * 100) / 100;
  if (!input.personId) return fail("Personne manquante");
  if (!(amount > 0)) return fail("Le montant doit être positif.");
  const supabase = await createClient();
  const { error } = await supabase.from("person_repayments").insert({
    person_id: input.personId,
    amount,
    repaid_on: input.repaidOn || undefined,
    transaction_id: input.transactionId || null,
    note: input.note?.trim() || null,
  });
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function deleteRepayment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("person_repayments")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}
