import { PageHeader } from "@/components/layout/PageHeader";
import { RulesManager } from "@/components/rules/RulesManager";
import { getRules, getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const [rules, subcategoryOptions, accountOptions, merchantOptions] =
    await Promise.all([
      getRules(),
      getSubcategoryOptions(),
      getAccountOptions(),
      getMerchantOptions(),
    ]);

  return (
    <>
      <PageHeader
        title="Règles"
        subtitle="Catégorise automatiquement tes transactions par motifs."
      />
      <RulesManager
        rules={rules}
        subcategoryOptions={subcategoryOptions}
        accountOptions={accountOptions}
        merchantOptions={merchantOptions}
      />
    </>
  );
}
