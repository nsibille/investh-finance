"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import { matchRule } from "@/lib/rules/matcher";
import { applyRuleToTransactions, toApplicableRule } from "@/server/rules/apply";
import type { RuleApplyScope } from "@/server/rules/apply";
import { ensureNamelessMerchant } from "@/server/merchants/nameless";
import { backfillMerchantCategory } from "@/lib/merchants/backfill";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Résultat d'un changement de catégorie. `merchantCategorized` est présent quand
 * la transaction était rattachée à une enseigne sans catégorie qui vient donc
 * d'hériter de cette catégorie (le client affiche un toaster explicatif).
 */
export type CategoryResult =
  | { ok: true; merchantCategorized?: { id: string; name: string } }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

/**
 * Enrobe le corps d'une action pour renvoyer toute exception sous forme de
 * `{ ok: false, error }` plutôt que de la laisser remonter. En production, Next
 * masque le message des exceptions *jetées* (« An error occurred in the Server
 * Components render… », remplacé par un digest) : impossible à diagnostiquer
 * côté client. Une valeur *retournée* n'est pas masquée — on récupère donc le
 * vrai message dans le toast. On log aussi côté serveur pour la stack complète.
 */
async function guard<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[transactions:${label}] exception non gérée:`, e);
    return fail(message || "Erreur serveur inconnue.");
  }
}

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/transactions/pending");
  revalidatePath("/dashboard");
}

export async function setTransactionSubcategory(
  id: string,
  subcategoryId: string | null,
): Promise<CategoryResult> {
  return guard("setSubcategory", async () => {
    const supabase = await createClient();
    // Catégorie héritée d'un achat : non modifiable tant que la transaction y est
    // rattachée.
    const { data: tx } = await supabase
      .from("transactions")
      .select("purchase_id")
      .eq("id", id)
      .maybeSingle();
    if (tx?.purchase_id) {
      return fail("Catégorie héritée de l'achat — détache la transaction pour la changer.");
    }
    const { error } = await supabase
      .from("transactions")
      .update({ subcategory_id: subcategoryId })
      .eq("id", id);
    if (error) return fail(error.message);
    // Enseigne parente sans catégorie : elle hérite de cette catégorie.
    const merchantCategorized = await backfillMerchantCategory(supabase, id, subcategoryId);
    revalidate();
    return { ok: true, merchantCategorized: merchantCategorized ?? undefined };
  });
}

export async function validateTransaction(
  id: string,
  subcategoryId: string | null,
): Promise<CategoryResult> {
  if (!subcategoryId) return fail("Choisis une sous-catégorie avant de valider.");
  return guard("validate", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transactions")
      .update({
        subcategory_id: subcategoryId,
        status: "validated",
        validated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return fail(error.message);
    // Enseigne parente sans catégorie : elle hérite de cette catégorie.
    const merchantCategorized = await backfillMerchantCategory(supabase, id, subcategoryId);
    revalidate();
    return { ok: true, merchantCategorized: merchantCategorized ?? undefined };
  });
}

export async function setTransactionStatus(
  id: string,
  status: "pending" | "validated" | "ignored",
): Promise<ActionResult> {
  return guard("setStatus", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transactions")
      .update({
        status,
        validated_at: status === "validated" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return fail(error.message);
    revalidate();
    return { ok: true };
  });
}

export async function updateTransactionNote(
  id: string,
  note: string,
): Promise<ActionResult> {
  return guard("updateNote", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ note: note.trim() || null })
      .eq("id", id);
    if (error) return fail(error.message);
    revalidatePath(`/transactions/${id}`);
    revalidate();
    return { ok: true };
  });
}

export async function bulkValidate(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return fail("Aucune transaction sélectionnée");
  return guard("bulkValidate", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .in("id", ids)
      .not("subcategory_id", "is", null);
    if (error) return fail(error.message);
    revalidate();
    return { ok: true };
  });
}

/** Counts existing transactions whose raw label would match a candidate rule. */
export async function previewRuleMatches(input: {
  match_type?: "regex" | "contains" | "exact";
  pattern: string;
  case_sensitive?: boolean;
  account_id?: string;
}): Promise<number> {
  if (!input.pattern) return 0;
  const supabase = await createClient();
  let q = supabase.from("transactions").select("raw_label");
  if (input.account_id) q = q.eq("account_id", input.account_id);
  const { data } = await q;
  const rule = {
    match_type: input.match_type ?? "regex",
    pattern: input.pattern,
    case_sensitive: Boolean(input.case_sensitive),
  };
  return (data ?? []).filter((t) => matchRule(rule, t.raw_label)).length;
}

export type RuleCreateResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

export async function createRuleFromTransaction(
  input: {
    name: string;
    match_type: "regex" | "contains" | "exact";
    pattern: string;
    case_sensitive?: boolean;
    account_id?: string | null;
    auto_validate?: boolean;
    priority?: number;
    /** Catégorie cible choisie dans le formulaire. */
    subcategoryId: string;
    /** Enseigne à rattacher ; sinon motif sous l'enseigne « Sans enseigne ». */
    merchantId?: string | null;
  },
  options: { transactionId?: string; applyScope?: RuleApplyScope } = {},
): Promise<RuleCreateResult> {
  if (!input.subcategoryId) return { ok: false, error: "Catégorie manquante" };
  const supabase = await createClient();

  // Enseigne propriétaire du motif : celle fournie (vraie marque), sinon
  // l'enseigne « Sans enseigne » de la sous-catégorie. Une enseigne fournie sans
  // catégorie hérite de la cible.
  let merchantId = input.merchantId ?? null;
  if (merchantId) {
    const { data: m } = await supabase
      .from("merchants")
      .select("subcategory_id")
      .eq("id", merchantId)
      .maybeSingle();
    if (!m) return { ok: false, error: "Enseigne introuvable" };
    if (!m.subcategory_id) {
      await supabase
        .from("merchants")
        .update({ subcategory_id: input.subcategoryId })
        .eq("id", merchantId);
    }
  } else {
    merchantId = await ensureNamelessMerchant(supabase, input.subcategoryId);
    if (!merchantId) return { ok: false, error: "Enseigne sans nom impossible" };
  }

  const ruleInput: RuleInput = {
    name: input.name,
    match_type: input.match_type,
    pattern: input.pattern,
    case_sensitive: input.case_sensitive ?? false,
    amount_min: "",
    amount_max: "",
    account_id: input.account_id ?? "",
    merchant_id: merchantId,
    auto_validate: input.auto_validate ?? true,
    priority: input.priority ?? 100,
    is_active: true,
  };
  const parsed = ruleSchema.safeParse(ruleInput);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };

  const { data: rule, error } = await supabase
    .from("categorization_rules")
    .insert({
      ...parsed.data,
      created_from_transaction_id: options.transactionId ?? null,
    })
    .select("*")
    .single();
  if (error || !rule)
    return { ok: false, error: error?.message ?? "Création impossible" };

  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, subcategory_id")
    .eq("id", merchantId)
    .maybeSingle();
  const applied = await applyRuleToTransactions(
    supabase,
    toApplicableRule(rule, merchant ?? null),
    options.applyScope ?? "none",
  );

  revalidate();
  return { ok: true, applied };
}
