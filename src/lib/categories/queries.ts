import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  CategoryTypeNode,
  CategoryNode,
  SubcategoryOption,
} from "./types";

// `cache()` dédoublonne les appels identiques dans un même rendu serveur :
// l'arbre des catégories (3 requêtes) n'est chargé qu'une fois par requête,
// même s'il est consommé par plusieurs helpers (options, display maps…).
export const getCategoryTree = cache(async function getCategoryTree(): Promise<
  CategoryTypeNode[]
> {
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
});

/** Slug du type réservé aux virements internes (exclu des KPIs revenus/dépenses). */
export const TRANSFER_TYPE_SLUG = "virements";

/**
 * Ids des sous-catégories de virement interne, dérivés de l'arbre (en cache).
 * Servent à exclure les virements des agrégats revenus/dépenses (ils ne sont
 * ni un revenu ni une dépense : l'argent circule entre comptes).
 */
export const getTransferSubcategoryIds = cache(
  async function getTransferSubcategoryIds(): Promise<Set<string>> {
    const tree = await getCategoryTree();
    const ids = new Set<string>();
    for (const type of tree) {
      if (type.slug !== TRANSFER_TYPE_SLUG) continue;
      for (const cat of type.categories)
        for (const sub of cat.subcategories) ids.add(sub.id);
    }
    return ids;
  },
);

/**
 * Ids des sous-catégories rattachées à un type de revenu (`is_income`).
 * Servent à rattacher les revenus de fin de mois au mois suivant (date de
 * valeur métier — cf. `lib/dashboard/accounting`).
 */
export const getIncomeSubcategoryIds = cache(
  async function getIncomeSubcategoryIds(): Promise<Set<string>> {
    const tree = await getCategoryTree();
    const ids = new Set<string>();
    for (const type of tree) {
      if (!type.is_income) continue;
      for (const cat of type.categories)
        for (const sub of cat.subcategories) ids.add(sub.id);
    }
    return ids;
  },
);

/** Flat options "Type / Catégorie / Sous-catégorie" for pickers. */
export const getSubcategoryOptions = cache(async function getSubcategoryOptions(): Promise<
  SubcategoryOption[]
> {
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
});
