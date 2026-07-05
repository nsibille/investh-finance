import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryTree } from "@/components/categories/CategoryTree";
import {
  getCategoryTree,
  getSubcategoryOptions,
} from "@/lib/categories/queries";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [tree, subcategoryOptions] = await Promise.all([
    getCategoryTree(),
    getSubcategoryOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Catégories"
        subtitle="Organise tes types, catégories et sous-catégories."
      />
      <CategoryTree tree={tree} subcategoryOptions={subcategoryOptions} />
    </>
  );
}
