"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { applyRuleToTransactions, toApplicableRule } from "@/server/rules/apply";
import { getMerchantStats, type MerchantStats } from "@/lib/merchants/stats";
import type { Database } from "@/types/database.types";

type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string; subcategoryId: string | null }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/enseignes");
  revalidatePath("/transactions");
  revalidatePath("/achats");
}

export interface MerchantInput {
  name: string;
  /**
   * Catégorie par défaut de l'enseigne. Créée « à la volée » depuis une
   * transaction, l'enseigne hérite automatiquement de la catégorie de celle-ci
   * (le client passe la sous-catégorie courante de la transaction).
   */
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
    .select("id, subcategory_id")
    .single();

  // Nom déjà pris (index unique lower(name)) : on renvoie l'enseigne existante
  // pour que la création « à la volée » reste idempotente. On ne touche pas à sa
  // catégorie (elle prime sur celle qu'on aurait héritée).
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("merchants")
        .select("id, subcategory_id")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      if (existing)
        return { ok: true, id: existing.id, subcategoryId: existing.subcategory_id };
    }
    return fail(error.message);
  }
  if (!data) return fail("Création impossible");

  revalidate();
  return { ok: true, id: data.id, subcategoryId: data.subcategory_id };
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
  // transactions/achats.merchant_id → NULL (ON DELETE SET NULL) ; les motifs de
  // l'enseigne sont supprimés en cascade (categorization_rules ON DELETE CASCADE).
  const { error } = await supabase.from("merchants").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/**
 * Statistiques d'une enseigne pour le quick view de la liste (lecture seule).
 * Le mois de référence (fenêtre 12 mois) est calculé côté serveur.
 */
export async function getMerchantQuickStats(id: string): Promise<MerchantStats | null> {
  const now = new Date();
  const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return getMerchantStats(id, refMonth);
}

export type AttachMerchantResult =
  | {
      ok: true;
      /** Catégorie par défaut effective de l'enseigne après rattachement. */
      subcategoryId: string | null;
      /** L'enseigne vient d'hériter de la catégorie de la transaction. */
      merchantCategorized: boolean;
    }
  | { ok: false; error: string };

/**
 * Rattache une transaction à une enseigne.
 * - Enseigne avec catégorie par défaut : elle est appliquée à la transaction
 *   (surchargeable — le sélecteur de catégorie reste actif) et la transaction
 *   est validée.
 * - Enseigne sans catégorie mais transaction catégorisée : l'enseigne hérite de
 *   la catégorie de la transaction (première transaction rattachée → catégorie
 *   de l'enseigne parente).
 */
export async function attachTransactionToMerchant(
  transactionId: string,
  merchantId: string,
  opts: { validate?: boolean } = {},
): Promise<AttachMerchantResult> {
  const validate = opts.validate !== false;
  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("merchants")
    .select("subcategory_id")
    .eq("id", merchantId)
    .maybeSingle();
  if (!merchant) return fail("Enseigne introuvable");

  const patch: TransactionUpdate = { merchant_id: merchantId };
  let subcategoryId = merchant.subcategory_id;
  let merchantCategorized = false;
  if (merchant.subcategory_id) {
    patch.subcategory_id = merchant.subcategory_id;
    if (validate) {
      patch.status = "validated";
      patch.validated_at = new Date().toISOString();
    }
  } else {
    const { data: tx } = await supabase
      .from("transactions")
      .select("subcategory_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (tx?.subcategory_id) {
      await supabase
        .from("merchants")
        .update({ subcategory_id: tx.subcategory_id })
        .eq("id", merchantId);
      subcategoryId = tx.subcategory_id;
      merchantCategorized = true;
    }
  }
  const { error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", transactionId);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true, subcategoryId, merchantCategorized };
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

  // Backfill : l'enseigne hérite de la catégorie si elle n'en avait pas (la
  // catégorie du motif = catégorie par défaut de l'enseigne).
  let categorySet = false;
  if (!merchant.subcategory_id) {
    await supabase
      .from("merchants")
      .update({ subcategory_id: subcategoryId })
      .eq("id", merchantId);
    categorySet = true;
  }

  // Motif « contient » identique déjà sous cette enseigne → rien à faire.
  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id")
    .eq("match_type", "contains")
    .eq("merchant_id", merchantId)
    .ilike("pattern", p)
    .limit(1);
  if (existing && existing.length > 0) {
    revalidate();
    return { ok: true, ruleId: existing[0].id, exists: true, pattern: p, categorySet };
  }

  const { data, error } = await supabase
    .from("categorization_rules")
    .insert({
      name: p.slice(0, 120),
      match_type: "contains",
      pattern: p,
      case_sensitive: false,
      merchant_id: merchantId,
      auto_validate: true,
      priority: 100,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Motif impossible" };

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
  // Doublon déjà rattaché à cette enseigne → réutilisé (tout motif appartient
  // désormais à une enseigne : plus de « règle simple » à mettre à niveau).
  const { data: dupe } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("match_type", matchType)
    .eq("merchant_id", merchantId)
    .ilike("pattern", pattern)
    .limit(1);
  let rule = dupe && dupe.length > 0 ? dupe[0] : null;

  if (!rule) {
    const { data: created, error } = await supabase
      .from("categorization_rules")
      .insert({
        name: `${merchant.name ?? ""} → ${pattern}`.trim().slice(0, 120),
        match_type: matchType,
        pattern,
        case_sensitive: false,
        merchant_id: merchantId,
        auto_validate: true,
        priority: 100,
        is_active: true,
      })
      .select("*")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Motif impossible" };
    rule = created;
  }

  const applied = applyToUncategorized
    ? await applyRuleToTransactions(
        supabase,
        toApplicableRule(rule, merchant),
        "uncategorized",
      )
    : 0;

  revalidate();
  return { ok: true, applied, ruleId: rule.id, pattern };
}
