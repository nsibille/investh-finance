import { PageHeader } from "@/components/layout/PageHeader";
import { MerchantsManager } from "@/components/merchants/MerchantsManager";
import { getMerchants } from "@/lib/merchants/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";

export const dynamic = "force-dynamic";

export default async function EnseignesPage() {
  const [merchants, subcategoryOptions] = await Promise.all([
    getMerchants(),
    getSubcategoryOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Enseignes"
        subtitle="Un nom commercial, une catégorie par défaut et des règles : transactions et achats s'y rattachent automatiquement."
      />
      <MerchantsManager
        merchants={merchants}
        subcategoryOptions={subcategoryOptions}
      />
    </>
  );
}
