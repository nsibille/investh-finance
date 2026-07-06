import { PageHeader } from "@/components/layout/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PurchasesManager } from "@/components/purchases/PurchasesManager";
import { getPurchases } from "@/lib/purchases/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";

export const dynamic = "force-dynamic";

export default async function AchatsTerminesPage() {
  await ensureRecurringInstallments();
  const [purchases, subcategoryOptions, merchantOptions] = await Promise.all([
    getPurchases(),
    getSubcategoryOptions(),
    getMerchantOptions(),
  ]);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Achats", href: "/achats" }, { label: "Terminés" }]}
      />
      <div style={{ marginTop: "var(--space-5)" }}>
        <PageHeader
          title="Achats terminés"
          subtitle="Les achats soldés, rangés hors de la liste principale. Rouvre-en un pour le renvoyer dans les achats en cours."
        />
        <PurchasesManager
          purchases={purchases}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          scope="done"
        />
      </div>
    </>
  );
}
