"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInternalTransferSubcategoryId } from "@/lib/import/transfers";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/transactions/transfers");
  revalidatePath("/transactions");
  revalidatePath("/transactions/pending");
  revalidatePath("/dashboard");
}

/**
 * Apparie deux transactions en un virement interne : elles reçoivent la
 * sous-catégorie « Virement interne », passent en « validée » et partagent un
 * même `transfer_group_id`. Sert à la fois à réconcilier un orphelin et à
 * confirmer un candidat non catégorisé.
 */
export async function pairInternalTransfer(
  idA: string,
  idB: string,
): Promise<ActionResult> {
  try {
    if (!idA || !idB || idA === idB) return fail("Sélection invalide.");
    const supabase = await createClient();
    const subId = await getInternalTransferSubcategoryId(supabase);
    if (!subId) return fail("Catégorie « Virement interne » introuvable.");

    const { data: legs, error: readErr } = await supabase
      .from("transactions")
      .select("id, account_id, amount")
      .in("id", [idA, idB]);
    if (readErr) return fail(readErr.message);
    if (!legs || legs.length !== 2) return fail("Transactions introuvables.");

    const [a, b] = legs;
    if (a.account_id === b.account_id) {
      return fail("Les deux jambes doivent être sur deux comptes différents.");
    }
    if (Math.sign(Number(a.amount)) === Math.sign(Number(b.amount))) {
      return fail("Un virement interne oppose une sortie et une entrée.");
    }

    const groupId = randomUUID();
    const { error } = await supabase
      .from("transactions")
      .update({
        subcategory_id: subId,
        status: "validated",
        validated_at: new Date().toISOString(),
        transfer_group_id: groupId,
      })
      .in("id", [idA, idB]);
    if (error) return fail(error.message);

    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur serveur.");
  }
}

/**
 * Dissocie une paire : les deux jambes restent « Virement interne » mais
 * perdent leur `transfer_group_id` et redeviennent des orphelins.
 */
export async function unpairInternalTransfer(
  groupId: string,
): Promise<ActionResult> {
  try {
    if (!groupId) return fail("Groupe invalide.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ transfer_group_id: null })
      .eq("transfer_group_id", groupId);
    if (error) return fail(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur serveur.");
  }
}

/**
 * Retire une transaction des virements internes : elle est décatégorisée,
 * repasse « à valider » et perd son groupe. Son éventuelle contrepartie perd
 * aussi le groupe (elle devient orpheline, à re-réconcilier).
 */
export async function removeFromInternalTransfers(
  id: string,
): Promise<ActionResult> {
  try {
    if (!id) return fail("Transaction invalide.");
    const supabase = await createClient();

    const { data: tx } = await supabase
      .from("transactions")
      .select("transfer_group_id")
      .eq("id", id)
      .maybeSingle();

    if (tx?.transfer_group_id) {
      // Casse le groupe : la contrepartie redevient orpheline.
      await supabase
        .from("transactions")
        .update({ transfer_group_id: null })
        .eq("transfer_group_id", tx.transfer_group_id);
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        subcategory_id: null,
        status: "pending",
        validated_at: null,
        transfer_group_id: null,
      })
      .eq("id", id);
    if (error) return fail(error.message);

    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur serveur.");
  }
}
