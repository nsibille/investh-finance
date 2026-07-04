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
  const { error } = await supabase.from("categories").insert({
    category_type_id: parsed.data.category_type_id,
    name: parsed.data.name,
    color: parsed.data.color ? parsed.data.color : null,
  });
  if (error) return fail(error.message);
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
