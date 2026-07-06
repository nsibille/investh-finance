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

export type ActionResult = { ok: true } | { ok: false; error: string };

export type RuleSaveResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

function fail(message: string): ActionResult {
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
