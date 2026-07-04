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
  | { ok: true; applied: number }
  | { ok: false; error: string };

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

  const { data: rule, error } = await supabase
    .from("categorization_rules")
    .insert({
      name: `${merchant.name} → ${pattern}`.slice(0, 120),
      match_type: input.matchType ?? "contains",
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
  return { ok: true, applied };
}
