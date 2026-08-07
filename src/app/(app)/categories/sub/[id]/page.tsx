import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EntityStatsView } from "@/components/stats/EntityStatsView";
import { getSubcategoryDetailStats } from "@/lib/categories/stats";

export const dynamic = "force-dynamic";

export default async function SubcategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zoom?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const zoom = sp.zoom && /^\d{4}-\d{2}$/.test(sp.zoom) ? sp.zoom : null;
  const stats = await getSubcategoryDetailStats(id, refMonth, zoom);

  if (!stats) notFound();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Catégories", href: "/categories" },
          { label: stats.name },
        ]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <EntityStatsView stats={stats} />
      </div>
    </>
  );
}
