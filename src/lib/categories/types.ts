import type { Database } from "@/types/database.types";

export type CategoryType =
  Database["public"]["Tables"]["category_types"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Subcategory =
  Database["public"]["Tables"]["subcategories"]["Row"];

export interface CategoryNode extends Category {
  subcategories: Subcategory[];
}

export interface CategoryTypeNode extends CategoryType {
  categories: CategoryNode[];
}

export interface SubcategoryOption {
  id: string;
  /** "Type / Catégorie / Sous-catégorie" */
  label: string;
  categoryColor: string | null;
  /** Catégorie parente (id) — pour le drill-down par catégorie. */
  categoryId?: string;
  /** Niveau 1 — ex. "Dépenses" */
  typeName: string;
  /** Niveau 2 — ex. "Alimentation" */
  categoryName: string;
  /** Niveau 3 — `null` quand la sous-catégorie est le placeholder "—" */
  subName: string | null;
}
