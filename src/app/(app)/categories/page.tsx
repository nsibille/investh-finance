import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryTree } from "@/components/categories/CategoryTree";
import {
  getCategoryTree,
  getSubcategoryOptions,
} from "@/lib/categories/queries";
import { getCategoryStats } from "@/lib/categories/stats";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ zoom?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const zoom = sp.zoom && /^\d{4}-\d{2}$/.test(sp.zoom) ? sp.zoom : null;

  const [tree, subcategoryOptions, stats] = await Promise.all([
    getCategoryTree(),
    getSubcategoryOptions(),
    getCategoryStats(now, zoom),
  ]);

  const validZoom = zoom && stats.months.includes(zoom) ? zoom : null;

  return (
    <>
      <PageHeader
        title="Catégories"
        subtitle="Organise tes types, catégories et sous-catégories."
      />
      <CategoryTree
        tree={tree}
        subcategoryOptions={subcategoryOptions}
        stats={stats}
        zoom={validZoom}
      />
    </>
  );
}
