"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/categories/queries";
import {
  categorySchema,
  subcategorySchema,
  type CategoryInput,
  type SubcategoryInput,
} from "@/lib/categories/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function createCategory(
  input: CategoryInput,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from("categories")
    .insert({
      category_type_id: parsed.data.category_type_id,
      name: parsed.data.name,
      color: parsed.data.color ? parsed.data.color : null,
    })
    .select("id")
    .single();
  if (error || !category) return fail(error?.message ?? "Création impossible");

  // Sous-catégorie « — » par défaut : garantit que la catégorie parente est
  // toujours sélectionnable dans les pickers.
  const { error: subError } = await supabase
    .from("subcategories")
    .insert({ category_id: category.id, name: "—", sort_order: 0 });
  if (subError) return fail(subError.message);

  revalidatePath("/categories");
  return { ok: true };
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      category_type_id: parsed.data.category_type_id,
      name: parsed.data.name,
      color: parsed.data.color ? parsed.data.color : null,
    })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true };
}

export interface CategoryDeletionImpact {
  categoryName: string;
  /** Ids des sous-catégories de la catégorie (cibles des réaffectations). */
  subcategoryIds: string[];
  rules: number;
  merchants: number;
  recurring: number;
  transactions: number;
  purchases: number;
}

/**
 * Récapitulatif des objets rattachés aux sous-catégories d'une catégorie, pour
 * confirmer une suppression en connaissance de cause.
 */
export async function getCategoryDeletionImpact(
  categoryId: string,
): Promise<
  { ok: true; impact: CategoryDeletionImpact } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  if (!cat) return fail("Catégorie introuvable");

  const { data: subs } = await supabase
    .from("subcategories")
    .select("id")
    .eq("category_id", categoryId);
  const subcategoryIds = (subs ?? []).map((s) => s.id);

  const empty: CategoryDeletionImpact = {
    categoryName: cat.name,
    subcategoryIds,
    rules: 0,
    merchants: 0,
    recurring: 0,
    transactions: 0,
    purchases: 0,
  };
  if (subcategoryIds.length === 0) return { ok: true, impact: empty };

  const countIn = async (
    table:
      | "categorization_rules"
      | "merchants"
      | "recurring_patterns"
      | "transactions"
      | "purchases",
  ) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("subcategory_id", subcategoryIds);
    return count ?? 0;
  };

  const [rules, merchants, recurring, transactions, purchases] =
    await Promise.all([
      countIn("categorization_rules"),
      countIn("merchants"),
      countIn("recurring_patterns"),
      countIn("transactions"),
      countIn("purchases"),
    ]);

  return {
    ok: true,
    impact: { ...empty, rules, merchants, recurring, transactions, purchases },
  };
}

/**
 * Supprime une catégorie (et ses sous-catégories en cascade).
 * - Avec `substituteSubcategoryId` : réaffecte d'abord tous les objets rattachés
 *   (règles, enseignes, récurrences, transactions, achats) à cette sous-catégorie
 *   de substitution — les règles seraient sinon supprimées en cascade.
 * - Sans substitution : les FK `ON DELETE` s'appliquent (règles et budgets
 *   supprimés ; transactions/récurrences/achats/enseignes décatégorisés).
 */
export async function deleteCategory(
  categoryId: string,
  substituteSubcategoryId?: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("subcategories")
    .select("id")
    .eq("category_id", categoryId);
  const subIds = (subs ?? []).map((s) => s.id);

  if (substituteSubcategoryId) {
    if (subIds.includes(substituteSubcategoryId))
      return fail("La catégorie de substitution doit être différente.");

    if (subIds.length > 0) {
      // Les motifs (categorization_rules) n'ont plus de sous-catégorie propre :
      // leur catégorie suit celle de leur enseigne, mise à jour ci-dessous.
      const tables = [
        "transactions",
        "recurring_patterns",
        "purchases",
        "merchants",
      ] as const;
      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .update({ subcategory_id: substituteSubcategoryId })
          .in("subcategory_id", subIds);
        if (error) return fail(error.message);
      }
      // Budgets (niche) : supprimés plutôt que réaffectés (contrainte d'unicité).
      await supabase.from("budgets").delete().in("subcategory_id", subIds);
    }
    await supabase.from("budgets").delete().eq("category_id", categoryId);
  }

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return fail(error.message);

  revalidatePath("/categories");
  revalidatePath("/recurring");
  revalidatePath("/enseignes");
  revalidatePath("/achats");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true };
}

/** Réordonne des catégories : `sort_order` = position dans la liste fournie. */
export async function reorderCategories(
  orderedIds: string[],
): Promise<ActionResult> {
  if (orderedIds.length === 0) return { ok: true };
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("categories").update({ sort_order: index }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message);
  revalidatePath("/categories");
  return { ok: true };
}

/** Réordonne des sous-catégories au sein d'une catégorie. */
export async function reorderSubcategories(
  orderedIds: string[],
): Promise<ActionResult> {
  if (orderedIds.length === 0) return { ok: true };
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("subcategories").update({ sort_order: index }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message);
  revalidatePath("/categories");
  return { ok: true };
}

/**
 * Promeut une sous-catégorie en catégorie (drag vers le niveau type) : crée une
 * catégorie du nom de la sous-catégorie, sous laquelle la sous-catégorie devient
 * la « — » par défaut. Les transactions (qui pointent la sous-catégorie) sont
 * préservées.
 */
export async function promoteSubcategoryToCategory(
  subId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subcategories")
    .select("id, name, category_id")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return fail("Sous-catégorie introuvable");
  if (sub.name === "—")
    return fail("La sous-catégorie par défaut ne peut pas devenir une catégorie.");

  const { data: parent } = await supabase
    .from("categories")
    .select("category_type_id")
    .eq("id", sub.category_id)
    .maybeSingle();
  if (!parent) return fail("Catégorie parente introuvable");

  const { data: newCat, error } = await supabase
    .from("categories")
    .insert({
      category_type_id: parent.category_type_id,
      name: sub.name.slice(0, 80),
      sort_order: 999,
    })
    .select("id")
    .single();
  if (error || !newCat) return fail(error?.message ?? "Création impossible");

  const { error: moveErr } = await supabase
    .from("subcategories")
    .update({ category_id: newCat.id, name: "—" })
    .eq("id", subId);
  if (moveErr) return fail(moveErr.message);

  revalidatePath("/categories");
  return { ok: true };
}

/**
 * Rétrograde une catégorie en sous-catégorie d'une autre (drag d'une catégorie
 * dans une catégorie cible). Cas courant (≤ 1 sous-catégorie) : elle devient une
 * seule sous-catégorie du nom de la catégorie. Sinon, ses sous-catégories sont
 * déplacées sous la cible (fusion). L'ancienne catégorie est supprimée.
 */
export async function demoteCategoryToSubcategory(
  catId: string,
  targetCategoryId: string,
): Promise<ActionResult> {
  if (catId === targetCategoryId) return fail("Cible invalide");
  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", catId)
    .maybeSingle();
  if (!cat) return fail("Catégorie introuvable");

  const { data: subs } = await supabase
    .from("subcategories")
    .select("id, name")
    .eq("category_id", catId);
  const list = subs ?? [];

  if (list.length <= 1) {
    const only = list[0];
    if (only) {
      const newName = (only.name === "—" ? cat.name : only.name).slice(0, 80);
      const { error } = await supabase
        .from("subcategories")
        .update({ category_id: targetCategoryId, name: newName })
        .eq("id", only.id);
      if (error) return fail(error.message);
    } else {
      const { error } = await supabase
        .from("subcategories")
        .insert({ category_id: targetCategoryId, name: cat.name.slice(0, 80), sort_order: 999 });
      if (error) return fail(error.message);
    }
  } else {
    const { error } = await supabase
      .from("subcategories")
      .update({ category_id: targetCategoryId })
      .eq("category_id", catId);
    if (error) return fail(error.message);
  }

  const { error: delErr } = await supabase.from("categories").delete().eq("id", catId);
  if (delErr) return fail(delErr.message);

  revalidatePath("/categories");
  return { ok: true };
}

export async function createSubcategory(
  input: SubcategoryInput,
): Promise<CreateResult> {
  const parsed = subcategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subcategories")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true, id: data.id };
}

/**
 * Creates a category and its default "—" subcategory in one go, so the new
 * category is immediately selectable in pickers. Returns the placeholder
 * subcategory id (the value a category-picker stores).
 */
export async function createCategoryWithDefaultSub(
  input: CategoryInput,
): Promise<CreateResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from("categories")
    .insert({
      category_type_id: parsed.data.category_type_id,
      name: parsed.data.name,
      color: parsed.data.color ? parsed.data.color : null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const { data: sub, error: subError } = await supabase
    .from("subcategories")
    .insert({ category_id: category.id, name: "—", sort_order: 0 })
    .select("id")
    .single();
  if (subError) return fail(subError.message);

  revalidatePath("/categories");
  return { ok: true, id: sub.id };
}

export type CreateOnTheFlyResult =
  | {
      ok: true;
      subcategoryId: string;
      categoryName: string;
      typeName: string;
      categoryColor: string | null;
      label: string;
    }
  | { ok: false; error: string };

/**
 * Crée une catégorie à la volée (depuis l'import) : rattachée au type
 * « Frais Variables » par défaut (à reclasser ensuite), avec sa sous-catégorie
 * « — ». Réutilise une catégorie de même nom si elle existe déjà. Retourne la
 * sous-catégorie à assigner.
 */
export async function createCategoryOnTheFly(
  name: string,
): Promise<CreateOnTheFlyResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return fail("Nom invalide");

  const supabase = await createClient();
  const { data: type } = await supabase
    .from("category_types")
    .select("id, name")
    .eq("slug", "frais-variables")
    .maybeSingle();
  if (!type) return fail("Type « Frais Variables » introuvable");

  const { data: existing } = await supabase
    .from("categories")
    .select("id, category_type_id")
    .ilike("name", trimmed)
    .limit(1);

  let categoryId: string;
  let typeName = type.name;
  if (existing && existing.length > 0) {
    categoryId = existing[0].id;
    const { data: t } = await supabase
      .from("category_types")
      .select("name")
      .eq("id", existing[0].category_type_id)
      .maybeSingle();
    typeName = t?.name ?? type.name;
  } else {
    const { data: cat, error } = await supabase
      .from("categories")
      .insert({ category_type_id: type.id, name: trimmed, sort_order: 0 })
      .select("id")
      .single();
    if (error || !cat) return fail(error?.message ?? "Catégorie impossible");
    categoryId = cat.id;
  }

  const { data: sub } = await supabase
    .from("subcategories")
    .select("id")
    .eq("category_id", categoryId)
    .eq("name", "—")
    .maybeSingle();
  let subcategoryId = sub?.id;
  if (!subcategoryId) {
    const { data: newSub, error } = await supabase
      .from("subcategories")
      .insert({ category_id: categoryId, name: "—", sort_order: 0 })
      .select("id")
      .single();
    if (error || !newSub) return fail(error?.message ?? "Sous-catégorie impossible");
    subcategoryId = newSub.id;
  }

  revalidatePath("/categories");
  return {
    ok: true,
    subcategoryId,
    categoryName: trimmed,
    typeName,
    categoryColor: null,
    label: `${typeName} / ${trimmed}`,
  };
}

export type CategoryParents = {
  types: { id: string; name: string }[];
  categories: { id: string; name: string; typeName: string; color: string | null }[];
};

/** Lightweight parent lists (types + non-archived categories) for inline creation. */
export async function getCategoryParents(): Promise<CategoryParents> {
  const tree = await getCategoryTree();
  const categories: CategoryParents["categories"] = [];
  for (const type of tree) {
    for (const cat of type.categories) {
      if (cat.is_archived) continue;
      categories.push({
        id: cat.id,
        name: cat.name,
        typeName: type.name,
        color: cat.color,
      });
    }
  }
  return { types: tree.map((t) => ({ id: t.id, name: t.name })), categories };
}

export async function updateSubcategory(
  id: string,
  name: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return fail("Nom invalide");

  const supabase = await createClient();
  const { error } = await supabase
    .from("subcategories")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true };
}

export async function setSubcategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subcategories")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true };
}
