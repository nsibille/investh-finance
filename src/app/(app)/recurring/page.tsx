import { PageHeader } from "@/components/layout/PageHeader";
import { RecurringManager } from "@/components/recurring/RecurringManager";
import { getRecurringPatterns } from "@/lib/recurring/queries";
import { getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [patterns, accountOptions, subcategoryOptions, merchantOptions] =
    await Promise.all([
      getRecurringPatterns(),
      getAccountOptions(),
      getSubcategoryOptions(),
      getMerchantOptions(),
    ]);

  return (
    <>
      <PageHeader
        title="Récurrentes"
        subtitle="Suis tes abonnements et revenus réguliers, et repère les manquants."
      />
      <RecurringManager
        patterns={patterns}
        accountOptions={accountOptions}
        subcategoryOptions={subcategoryOptions}
        merchantOptions={merchantOptions}
      />
    </>
  );
}
