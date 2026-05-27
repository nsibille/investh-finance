import { createClient } from "@/lib/supabase/server";
import type {
  CategoryTypeNode,
  CategoryNode,
  SubcategoryOption,
} from "./types";

export async function getCategoryTree(): Promise<CategoryTypeNode[]> {
  const supabase = await createClient();

  const [{ data: types }, { data: categories }, { data: subcategories }] =
    await Promise.all([
      supabase
        .from("category_types")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("subcategories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  const subsByCategory = new Map<string, typeof subcategories>();
  for (const sub of subcategories ?? []) {
    const list = subsByCategory.get(sub.category_id) ?? [];
    list.push(sub);
    subsByCategory.set(sub.category_id, list);
  }

  const catsByType = new Map<string, CategoryNode[]>();
  for (const cat of categories ?? []) {
    const node: CategoryNode = {
      ...cat,
      subcategories: subsByCategory.get(cat.id) ?? [],
    };
    const list = catsByType.get(cat.category_type_id) ?? [];
    list.push(node);
    catsByType.set(cat.category_type_id, list);
  }

  return (types ?? []).map((type) => ({
    ...type,
    categories: catsByType.get(type.id) ?? [],
  }));
}

/** Flat options "Type / Catégorie / Sous-catégorie" for pickers. */
export async function getSubcategoryOptions(): Promise<SubcategoryOption[]> {
  const tree = await getCategoryTree();
  const options: SubcategoryOption[] = [];
  for (const type of tree) {
    for (const cat of type.categories) {
      if (cat.is_archived) continue;
      for (const sub of cat.subcategories) {
        if (sub.is_archived) continue;
        const subName = sub.name === "—" ? null : sub.name;
        const subLabel = subName ? ` / ${subName}` : "";
        options.push({
          id: sub.id,
          label: `${type.name} / ${cat.name}${subLabel}`,
          categoryColor: cat.color,
          typeName: type.name,
          categoryName: cat.name,
          subName,
        });
      }
    }
  }
  return options;
}
