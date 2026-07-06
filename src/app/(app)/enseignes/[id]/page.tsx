import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { MerchantDetailView } from "@/components/merchants/MerchantDetailView";
import { getMerchantStats } from "@/lib/merchants/stats";

export const dynamic = "force-dynamic";

export default async function EnseigneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();
  const refMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const stats = await getMerchantStats(id, refMonth);

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
