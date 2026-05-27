import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryTree } from "@/components/categories/CategoryTree";
import { getCategoryTree } from "@/lib/categories/queries";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const tree = await getCategoryTree();

  return (
    <>
      <PageHeader
        title="Catégories"
        subtitle="Organise tes types, catégories et sous-catégories."
      />
      <CategoryTree tree={tree} />
    </>
  );
}
