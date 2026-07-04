import { PageHeader } from "@/components/layout/PageHeader";
import { PurchasesManager } from "@/components/purchases/PurchasesManager";
import { getPurchases } from "@/lib/purchases/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";

export const dynamic = "force-dynamic";

export default async function AchatsPage() {
  const [purchases, subcategoryOptions] = await Promise.all([
    getPurchases(),
    getSubcategoryOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Achats"
        subtitle="Regroupe des transactions sous un même achat, avec catégorie héritée et mensualités."
      />
      <PurchasesManager
        purchases={purchases}
        subcategoryOptions={subcategoryOptions}
      />
    </>
  );
}
