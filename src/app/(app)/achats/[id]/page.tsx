import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PurchaseDetailView } from "@/components/purchases/PurchaseDetailView";
import { getPurchaseDetail, getPurchases } from "@/lib/purchases/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { getPersonOptions } from "@/lib/persons/queries";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";
import type { PurchaseParentOption } from "@/lib/purchases/types";

export const dynamic = "force-dynamic";

export default async function AchatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Étend l'horizon des abonnements sans fin avant l'affichage.
  await ensureRecurringInstallments();
  const [detail, all, subcategoryOptions, merchantOptions, personOptions] =
    await Promise.all([
      getPurchaseDetail(id),
      getPurchases(),
      getSubcategoryOptions(),
      getMerchantOptions(),
      getPersonOptions(),
    ]);

  if (!detail) notFound();

  const parentOptions: PurchaseParentOption[] = all.map((o) => ({
    id: o.id,
    name: o.name,
    parentId: o.parent_id,
    isArchived: o.is_archived,
  }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Achats", href: "/achats" },
          ...(detail.parent
            ? [{ label: detail.parent.name, href: `/achats/${detail.parent.id}` }]
            : []),
          { label: detail.name },
        ]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <PurchaseDetailView
          detail={detail}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          parentOptions={parentOptions}
          personOptions={personOptions}
        />
      </div>
    </>
  );
}
