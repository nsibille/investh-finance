"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  subcategorySchema,
  type CategoryInput,
  type SubcategoryInput,
} from "@/lib/categories/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(message: string): ActionResult {
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
): Promise<ActionResult> {
  const parsed = subcategorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalide");

  const supabase = await createClient();
  const { error } = await supabase.from("subcategories").insert(parsed.data);
  if (error) return fail(error.message);
  revalidatePath("/categories");
  return { ok: true };
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
