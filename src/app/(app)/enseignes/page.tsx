import { PageHeader } from "@/components/layout/PageHeader";
import { MerchantsManager } from "@/components/merchants/MerchantsManager";
import { getMerchants } from "@/lib/merchants/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getAccountOptions } from "@/lib/rules/queries";

export const dynamic = "force-dynamic";

export default async function EnseignesPage() {
  const [merchants, subcategoryOptions, accountOptions] = await Promise.all([
    getMerchants(),
    getSubcategoryOptions(),
    getAccountOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Enseignes"
        subtitle="Un nom, une catégorie par défaut et des motifs : chaque enseigne catégorise et se rattache aux transactions. Les motifs sans marque vivent sous « Sans enseigne »."
      />
      <MerchantsManager
        merchants={merchants}
        subcategoryOptions={subcategoryOptions}
        accountOptions={accountOptions}
      />
    </>
  );
}
