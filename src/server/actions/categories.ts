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
