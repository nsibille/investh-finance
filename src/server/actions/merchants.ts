"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyRuleToTransactions } from "@/server/rules/apply";
import type { Database } from "@/types/database.types";

type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/enseignes");
  revalidatePath("/transactions");
  revalidatePath("/achats");
  revalidatePath("/rules");
}

export interface MerchantInput {
  name: string;
  subcategoryId?: string | null;
  /** Pays de l'enseigne (libre) ; ignoré si `isOnline`. */
  country?: string | null;
  /** Enseigne en ligne (Internet). */
  isOnline?: boolean;
}

export async function createMerchant(input: MerchantInput): Promise<CreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const isOnline = input.isOnline ?? false;
  const { data, error } = await supabase
    .from("merchants")
    .insert({
      name,
      subcategory_id: input.subcategoryId ?? null,
      is_online: isOnline,
      country: isOnline ? null : input.country?.trim() || null,
    })
    .select("id")
    .single();

  // Nom déjà pris (index unique lower(name)) : on renvoie l'enseigne existante
  // pour que la création « à la volée » reste idempotente.
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("merchants")
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

export async function updateMerchant(
  id: string,
  input: MerchantInput,
): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) return fail("Nom invalide (1–120 caractères)");
  const supabase = await createClient();
  const isOnline = input.isOnline ?? false;
  const { error } = await supabase
    .from("merchants")
    .update({
      name,
      subcategory_id: input.subcategoryId ?? null,
      is_online: isOnline,
      country: isOnline ? null : input.country?.trim() || null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return fail("Une enseigne porte déjà ce nom.");
    return fail(error.message);
  }
  revalidate();
  return { ok: true };
}

export async function deleteMerchant(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // transactions/achats/règles.merchant_id → NULL (ON DELETE SET NULL).
  const { error } = await supabase.from("merchants").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/**
 * Rattache une transaction à une enseigne : applique la catégorie par défaut de
 * l'enseigne (surchargeable — le sélecteur de catégorie reste actif).
 */
export async function attachTransactionToMerchant(
  transactionId: string,
  merchantId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("subcategory_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!merchant) return fail("Enseigne introuvable");

  const patch: TransactionUpdate = { merchant_id: merchantId };
  if (merchant.subcategory_id) {
    patch.subcategory_id = merchant.subcategory_id;
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

export async function detachTransactionFromMerchant(
  transactionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ merchant_id: null })
    .eq("id", transactionId);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export type MerchantRuleResult =
  | { ok: true; applied: number; ruleId: string; pattern: string }
  | { ok: false; error: string };

export type MerchantRuleFromLabelResult =
  | { ok: true; ruleId: string; exists: boolean; pattern: string; categorySet: boolean }
  | { ok: false; error: string };

/**
 * Catégorise une transaction rattachée à une enseigne : la catégorie devient la
 * catégorie par défaut de l'enseigne si celle-ci n'en a pas encore, et la règle
 * créée (« contient » sur le libellé) est rattachée à l'enseigne. Idempotent
 * (renvoie la règle existante si un doublon enseigne+motif existe).
 */
export async function createMerchantRuleFromLabel(
  merchantId: string,
  pattern: string,
  subcategoryId: string,
): Promise<MerchantRuleFromLabelResult> {
  const p = pattern.trim();
  if (!p) return { ok: false, error: "Motif vide" };
  if (!subcategoryId) return { ok: false, error: "Catégorie manquante" };
  const supabase = await createClient();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("subcategory_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!merchant) return { ok: false, error: "Enseigne introuvable" };

  // Backfill : l'enseigne hérite de la catégorie si elle n'en avait pas.
  let categorySet = false;
  if (!merchant.subcategory_id) {
    await supabase
      .from("merchants")
      .update({ subcategory_id: subcategoryId })
      .eq("id", merchantId);
    categorySet = true;
  }

  // Règle « contient » identique déjà présente : rattachée à cette enseigne →
  // rien à faire ; sans enseigne (ancienne règle simple) → on la met à niveau
  // au lieu de créer un doublon qui masquerait le rattachement.
  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id, merchant_id")
    .eq("match_type", "contains")
    .ilike("pattern", p)
    .or(`merchant_id.eq.${merchantId},merchant_id.is.null`)
    .limit(1);
  if (existing && existing.length > 0) {
    const found = existing[0];
    if (!found.merchant_id) {
      await supabase
        .from("categorization_rules")
        .update({ merchant_id: merchantId, subcategory_id: subcategoryId })
        .eq("id", found.id);
    }
    revalidate();
    return { ok: true, ruleId: found.id, exists: true, pattern: p, categorySet };
  }

  const { data, error } = await supabase
    .from("categorization_rules")
    .insert({
      name: p.slice(0, 120),
      match_type: "contains",
      pattern: p,
      case_sensitive: false,
      subcategory_id: subcategoryId,
      merchant_id: merchantId,
      auto_validate: true,
      priority: 100,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Règle impossible" };

  revalidate();
  return { ok: true, ruleId: data.id, exists: false, pattern: p, categorySet };
}

/**
 * Ajoute une règle rattachée à l'enseigne (auto-rattachement à l'enseigne au
 * match). La sous-catégorie de la règle est la catégorie par défaut de
 * l'enseigne — l'enseigne doit donc en avoir une. Rejoue optionnellement sur
 * les transactions non catégorisées.
 */
export async function addMerchantRule(
  merchantId: string,
  input: { pattern: string; matchType?: "regex" | "exact" | "contains" },
  applyToUncategorized = true,
): Promise<MerchantRuleResult> {
  const pattern = input.pattern.trim();
  if (!pattern) return { ok: false, error: "Motif vide" };
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("name, subcategory_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!merchant) return { ok: false, error: "Enseigne introuvable" };
  if (!merchant.subcategory_id)
    return {
      ok: false,
      error: "Définis d'abord une catégorie par défaut pour l'enseigne.",
    };

  const matchType = input.matchType ?? "contains";
  // Évite les doublons : une règle identique déjà rattachée à cette enseigne est
  // réutilisée ; une règle « contient » identique sans enseigne est mise à
  // niveau (rattachée) plutôt que dupliquée.
  const { data: dupe } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("match_type", matchType)
    .ilike("pattern", pattern)
    .or(`merchant_id.eq.${merchantId},merchant_id.is.null`)
    .limit(1);
  if (dupe && dupe.length > 0) {
    let rule = dupe[0];
    if (!rule.merchant_id) {
      const { data: upgraded } = await supabase
        .from("categorization_rules")
        .update({ merchant_id: merchantId, subcategory_id: merchant.subcategory_id })
        .eq("id", rule.id)
        .select("*")
        .single();
      if (upgraded) rule = upgraded;
    }
    const applied = applyToUncategorized
      ? await applyRuleToTransactions(supabase, rule, "uncategorized")
      : 0;
    revalidate();
    return { ok: true, applied, ruleId: rule.id, pattern };
  }

  const { data: rule, error } = await supabase
    .from("categorization_rules")
    .insert({
      name: `${merchant.name} → ${pattern}`.slice(0, 120),
      match_type: matchType,
      pattern,
      case_sensitive: false,
      subcategory_id: merchant.subcategory_id,
      merchant_id: merchantId,
      auto_validate: true,
      priority: 100,
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !rule) return { ok: false, error: error?.message ?? "Règle impossible" };

  const applied = applyToUncategorized
    ? await applyRuleToTransactions(supabase, rule, "uncategorized")
    : 0;

  revalidate();
  return { ok: true, applied, ruleId: rule.id, pattern };
}
