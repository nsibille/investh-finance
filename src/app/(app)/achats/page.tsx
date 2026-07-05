import { PageHeader } from "@/components/layout/PageHeader";
import { PurchasesManager } from "@/components/purchases/PurchasesManager";
import { getPurchases } from "@/lib/purchases/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";

export const dynamic = "force-dynamic";

export default async function AchatsPage() {
  // Étend l'horizon des abonnements sans fin avant l'affichage.
  await ensureRecurringInstallments();
  const [purchases, subcategoryOptions, merchantOptions] = await Promise.all([
    getPurchases(),
    getSubcategoryOptions(),
    getMerchantOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Achats"
        subtitle="Regroupe des transactions sous un même achat (catégorie héritée, mensualités), ou en groupes pour budgéter un voyage ou un projet et suivre le total dépensé."
      />
      <PurchasesManager
        purchases={purchases}
        subcategoryOptions={subcategoryOptions}
        merchantOptions={merchantOptions}
      />
    </>
  );
}
