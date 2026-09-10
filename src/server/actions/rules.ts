"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import {
  applyRuleToTransactions,
  loadApplicableRule,
  toApplicableRule,
  type RuleApplyScope,
} from "@/server/rules/apply";
import { ensureNamelessMerchant } from "@/server/merchants/nameless";
import { purgeNamelessLabelDuplicates } from "@/server/rules/reassign";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type RuleSaveResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function revalidate() {
  revalidatePath("/enseignes");
  revalidatePath("/transactions");
}

/**
 * Crée ou met à jour un motif (rattaché à une enseigne), puis le rejoue
 * optionnellement sur les transactions existantes (`uncategorized` ou `all`).
 * La catégorie n'est plus portée par le motif : elle vient de l'enseigne.
 */
export async function saveRule(
  input: RuleInput,
  options: { id?: string; applyScope?: RuleApplyScope } = {},
): Promise<RuleSaveResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };

  const supabase = await createClient();
  let ruleId = options.id;

  if (ruleId) {
    const { error } = await supabase
      .from("categorization_rules")
      .update(parsed.data)
      .eq("id", ruleId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("categorization_rules")
      .insert(parsed.data)
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "Création impossible" };
    ruleId = data.id;
  }

  let applied = 0;
  const scope = options.applyScope ?? "none";
  if (scope !== "none") {
    const rule = await loadApplicableRule(supabase, ruleId);
    if (rule) applied = await applyRuleToTransactions(supabase, rule, scope);
  }

  revalidate();
  return { ok: true, applied };
}

export type MoveRuleResult =
  | { ok: true; moved: number; targetNamed: boolean }
  | { ok: false; error: string };

/**
 * Déplace un motif d'une enseigne vers une autre. Le motif est rattaché à
 * l'enseigne cible, puis rejoué sur toutes les transactions qu'il matche : elles
 * héritent alors de l'enseigne cible (si elle est nommée) et de sa catégorie par
 * défaut. Les transactions que le motif avait rattachées à l'enseigne d'origine
 * sont d'abord détachées, afin qu'un déplacement vers « Sans enseigne » les
 * libère bien de l'ancienne marque.
 */
export async function moveRuleToMerchant(
  ruleId: string,
  targetMerchantId: string,
): Promise<MoveRuleResult> {
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("categorization_rules")
    .select("id, merchant_id, is_active")
    .eq("id", ruleId)
    .maybeSingle();
  if (!rule) return fail("Motif introuvable");

  const sourceMerchantId = rule.merchant_id;
  if (sourceMerchantId === targetMerchantId)
    return { ok: true, moved: 0, targetNamed: false };

  const { data: target } = await supabase
    .from("merchants")
    .select("name, subcategory_id")
    .eq("id", targetMerchantId)
    .maybeSingle();
  if (!target) return fail("Enseigne cible introuvable");
  // Un motif tire sa catégorie de l'enseigne : la cible doit en avoir une
  // (même invariant que l'ajout d'un motif à une enseigne).
  if (!target.subcategory_id)
    return fail("L'enseigne cible n'a pas de catégorie par défaut.");
  const targetNamed = Boolean(target.name && target.name.trim());

  // 1. Rattacher le motif à l'enseigne cible.
  const { error: upErr } = await supabase
    .from("categorization_rules")
    .update({ merchant_id: targetMerchantId })
    .eq("id", ruleId);
  if (upErr) return fail(upErr.message);

  // Motif inactif : on déplace la propriété sans toucher aux transactions.
  if (!rule.is_active) {
    revalidate();
    return { ok: true, moved: 0, targetNamed };
  }

  // 2. Détacher les transactions que ce motif avait rattachées à l'enseigne
  // d'origine (réattachées à l'étape 3 si la cible est nommée).
  await supabase
    .from("transactions")
    .update({ merchant_id: null })
    .eq("applied_rule_id", ruleId)
    .eq("merchant_id", sourceMerchantId);

  // 3. Rejouer le motif : les transactions matchées héritent de l'enseigne cible
  // et de sa catégorie par défaut.
  const applicable = await loadApplicableRule(supabase, ruleId);
  const moved = applicable
    ? await applyRuleToTransactions(supabase, applicable, "all")
    : 0;

  revalidate();
  return { ok: true, moved, targetNamed };
}

export async function setRuleActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export type RuleFromLabelResult =
  | { ok: true; ruleId: string; exists: boolean; pattern: string }
  | { ok: false; error: string };

/**
 * Crée un motif « contient » à partir d'un libellé assigné (import/validation) :
 * pattern = libellé, catégorie = sous-catégorie fournie. Le motif est rattaché à
 * l'enseigne SANS NOM de cette sous-catégorie (groupe « Sans enseigne »). Renvoie
 * le motif existant si un doublon identique existe déjà sous cette enseigne.
 */
export async function createRuleFromLabel(
  pattern: string,
  subcategoryId: string,
): Promise<RuleFromLabelResult> {
  const p = pattern.trim();
  if (!p) return { ok: false, error: "Motif vide" };
  if (!subcategoryId) return { ok: false, error: "Catégorie manquante" };

  const supabase = await createClient();
  const merchantId = await ensureNamelessMerchant(supabase, subcategoryId);
  if (!merchantId) return { ok: false, error: "Enseigne sans nom impossible" };

  // Réassignation : ce libellé pointait peut-être vers une autre catégorie côté
  // « Sans enseigne ». On supprime l'ancien motif avant d'ajouter le nouveau.
  await purgeNamelessLabelDuplicates(supabase, p, merchantId);

  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id")
    .eq("match_type", "contains")
    .eq("merchant_id", merchantId)
    .ilike("pattern", p)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, ruleId: existing[0].id, exists: true, pattern: p };
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
  return { ok: true, ruleId: data.id, exists: false, pattern: p };
}

export interface RuleImportSummary {
  rulesCreated: number;
  categoriesCreated: number;
  subcategoriesCreated: number;
  skipped: number;
  applied: number;
}

export type RuleImportResult =
  | { ok: true; summary: RuleImportSummary }
  | { ok: false; error: string };

/**
 * Importe des motifs depuis un fichier à 2 colonnes (catégorie « Cat.Sous-cat »,
 * motif « contient »). Crée les catégories/sous-catégories manquantes (une
 * catégorie inconnue est rattachée à un type « Importées » créé au besoin) puis
 * les motifs, rattachés à l'enseigne SANS NOM de chaque sous-catégorie, en
 * ignorant les doublons. Rejoue optionnellement sur les transactions non
 * catégorisées.
 */
export async function importRules(
  rows: { category: string; subcategory: string; match: string }[],
  applyToUncategorized = true,
): Promise<RuleImportResult> {
  if (!rows.length) return { ok: false, error: "Aucune règle à importer" };

  const supabase = await createClient();
  const norm = (s: string) => s.trim().toLowerCase();

  const [{ data: types }, { data: cats }, { data: subs }, { data: existing }] =
    await Promise.all([
      supabase.from("category_types").select("id, name"),
      supabase.from("categories").select("id, name, category_type_id"),
      supabase.from("subcategories").select("id, name, category_id"),
      supabase
        .from("categorization_rules")
        .select("pattern, match_type, merchant_id"),
    ]);

  const typeByName = new Map((types ?? []).map((t) => [norm(t.name), t.id]));
  const catByName = new Map(
    (cats ?? []).map((c) => [norm(c.name), { id: c.id, typeId: c.category_type_id }]),
  );
  const subByKey = new Map(
    (subs ?? []).map((s) => [`${s.category_id}|${norm(s.name)}`, s.id]),
  );
  // Doublon = même motif « contient » déjà rattaché à la même enseigne.
  const ruleKeys = new Set(
    (existing ?? []).map(
      (r) => `${r.match_type}|${r.merchant_id}|${(r.pattern ?? "").toLowerCase()}`,
    ),
  );

  let defaultTypeId = typeByName.get(norm("Importées")) ?? null;
  async function ensureDefaultType(): Promise<string> {
    if (defaultTypeId) return defaultTypeId;
    const { data, error } = await supabase
      .from("category_types")
      .insert({ name: "Importées", slug: "importees", is_income: false, color: "#71717A", sort_order: 90 })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Type par défaut impossible");
    defaultTypeId = data.id;
    typeByName.set(norm("Importées"), data.id);
    return data.id;
  }

  // Enseigne sans nom par sous-catégorie, mémoïsée le temps de l'import.
  const namelessBySub = new Map<string, string>();
  async function namelessFor(subId: string): Promise<string> {
    const cached = namelessBySub.get(subId);
    if (cached) return cached;
    const id = await ensureNamelessMerchant(supabase, subId);
    if (!id) throw new Error("Enseigne sans nom impossible");
    namelessBySub.set(subId, id);
    return id;
  }

  const summary: RuleImportSummary = {
    rulesCreated: 0,
    categoriesCreated: 0,
    subcategoriesCreated: 0,
    skipped: 0,
    applied: 0,
  };
  const createdRules: { id: string; subId: string }[] = [];

  try {
    for (const row of rows) {
      let cat = catByName.get(norm(row.category));
      if (!cat) {
        const typeId = await ensureDefaultType();
        const { data, error } = await supabase
          .from("categories")
          .insert({ category_type_id: typeId, name: row.category.slice(0, 80), sort_order: 0 })
          .select("id, category_type_id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Catégorie impossible");
        cat = { id: data.id, typeId: data.category_type_id };
        catByName.set(norm(row.category), cat);
        summary.categoriesCreated += 1;
      }

      const subKey = `${cat.id}|${norm(row.subcategory)}`;
      let subId = subByKey.get(subKey);
      if (!subId) {
        const { data, error } = await supabase
          .from("subcategories")
          .insert({ category_id: cat.id, name: row.subcategory.slice(0, 80), sort_order: 0 })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Sous-catégorie impossible");
        subId = data.id;
        subByKey.set(subKey, subId);
        summary.subcategoriesCreated += 1;
      }

      const merchantId = await namelessFor(subId);
      const key = `contains|${merchantId}|${row.match.toLowerCase()}`;
      if (ruleKeys.has(key)) {
        summary.skipped += 1;
        continue;
      }
      const { data: created, error } = await supabase
        .from("categorization_rules")
        .insert({
          name: `${row.category} / ${row.subcategory}`.slice(0, 120),
          match_type: "contains",
          pattern: row.match,
          case_sensitive: false,
          merchant_id: merchantId,
          auto_validate: true,
          priority: 100,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Motif impossible");
      ruleKeys.add(key);
      createdRules.push({ id: created.id, subId });
      summary.rulesCreated += 1;
    }

    if (applyToUncategorized && createdRules.length) {
      const ids = createdRules.map((c) => c.id);
      const subByRule = new Map(createdRules.map((c) => [c.id, c.subId]));
      const { data: toApply } = await supabase
        .from("categorization_rules")
        .select("*")
        .in("id", ids);
      for (const r of toApply ?? []) {
        // Enseigne sans nom → catégorie = sous-cat du motif, pas de rattachement.
        const rule = toApplicableRule(r, {
          name: null,
          subcategory_id: subByRule.get(r.id) ?? null,
        });
        summary.applied += await applyRuleToTransactions(supabase, rule, "uncategorized");
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }

  revalidate();
  return { ok: true, summary };
}
