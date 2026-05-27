import { PageHeader } from "@/components/layout/PageHeader";
import { RulesManager } from "@/components/rules/RulesManager";
import { getRules, getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const [rules, subcategoryOptions, accountOptions] = await Promise.all([
    getRules(),
    getSubcategoryOptions(),
    getAccountOptions(),
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
      />
    </>
  );
}
