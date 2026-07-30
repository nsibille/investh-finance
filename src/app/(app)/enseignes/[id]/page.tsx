import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { MerchantDetailView } from "@/components/merchants/MerchantDetailView";
import { getMerchantStats } from "@/lib/merchants/stats";

export const dynamic = "force-dynamic";

export default async function EnseigneDetailPage({
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
  // Zoom mensuel : accepté seulement s'il tombe dans la fenêtre 12 mois affichée.
  const zoom = sp.zoom && /^\d{4}-\d{2}$/.test(sp.zoom) ? sp.zoom : null;
  const stats = await getMerchantStats(id, refMonth, zoom);

  if (!stats) notFound();

  return (
    <>
      <Breadcrumb
        items={[{ label: "Enseignes", href: "/enseignes" }, { label: stats.name }]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <MerchantDetailView stats={stats} />
      </div>
    </>
  );
}
