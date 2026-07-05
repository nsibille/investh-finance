"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import {
  applyRuleToTransactions,
  type RuleApplyScope,
} from "@/server/rules/apply";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type RuleSaveResult =
  | { ok: true; applied: number }
  | { ok: false; error: string };

function fail(message: string): ActionResult {
  return { ok: false, error: message };
}

/**
 * Creates or updates a rule, then optionally replays it over existing
 * transactions (`uncategorized` or `all`). Same apply semantics as creating a
 * rule from a transaction.
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
    const { data: rule } = await supabase
      .from("categorization_rules")
      .select("*")
      .eq("id", ruleId)
      .single();
    if (rule) applied = await applyRuleToTransactions(supabase, rule, scope);
  }

  revalidatePath("/rules");
  revalidatePath("/transactions");
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
  revalidatePath("/rules");
  return { ok: true };
}

export async function deleteRule(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/rules");
  return { ok: true };
}

export type RuleFromLabelResult =
  | { ok: true; ruleId: string; exists: boolean; pattern: string }
  | { ok: false; error: string };

/**
 * Crée une règle « contient » à partir d'un libellé assigné (import) :
 * pattern = libellé, cible = sous-catégorie. Renvoie la règle existante si une
 * règle identique (contient + même pattern + même sous-catégorie) existe déjà.
 */
export async function createRuleFromLabel(
  pattern: string,
  subcategoryId: string,
): Promise<RuleFromLabelResult> {
  const p = pattern.trim();
  if (!p) return { ok: false, error: "Motif vide" };
  if (!subcategoryId) return { ok: false, error: "Catégorie manquante" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id")
    .eq("match_type", "contains")
    .eq("subcategory_id", subcategoryId)
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
      subcategory_id: subcategoryId,
      auto_validate: true,
      priority: 100,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Règle impossible" };

  revalidatePath("/rules");
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
 * Importe des règles depuis un fichier à 2 colonnes (catégorie « Cat.Sous-cat »,
 * motif « contient »). Crée les catégories/sous-catégories manquantes (une
 * catégorie inconnue est rattachée à un type « Importées » créé au besoin) et
 * les règles, en ignorant les doublons. Rejoue optionnellement les règles créées
 * sur les transactions non catégorisées.
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
        .select("pattern, match_type, subcategory_id"),
    ]);

  const typeByName = new Map((types ?? []).map((t) => [norm(t.name), t.id]));
  const catByName = new Map(
    (cats ?? []).map((c) => [norm(c.name), { id: c.id, typeId: c.category_type_id }]),
  );
  const subByKey = new Map(
    (subs ?? []).map((s) => [`${s.category_id}|${norm(s.name)}`, s.id]),
  );
  const ruleKeys = new Set(
    (existing ?? []).map(
      (r) => `${r.match_type}|${r.subcategory_id}|${(r.pattern ?? "").toLowerCase()}`,
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

  const summary: RuleImportSummary = {
    rulesCreated: 0,
    categoriesCreated: 0,
    subcategoriesCreated: 0,
    skipped: 0,
    applied: 0,
  };
  const createdRuleIds: string[] = [];

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

      const key = `contains|${subId}|${row.match.toLowerCase()}`;
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
          subcategory_id: subId,
          auto_validate: true,
          priority: 100,
          is_active: true,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Règle impossible");
      ruleKeys.add(key);
      createdRuleIds.push(created.id);
      summary.rulesCreated += 1;
    }

    if (applyToUncategorized && createdRuleIds.length) {
      const { data: toApply } = await supabase
        .from("categorization_rules")
        .select("*")
        .in("id", createdRuleIds);
      for (const r of toApply ?? []) {
        summary.applied += await applyRuleToTransactions(supabase, r, "uncategorized");
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }

  revalidatePath("/rules");
  revalidatePath("/transactions");
  return { ok: true, summary };
}
