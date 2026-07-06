import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { PendingValidator } from "@/components/transactions/PendingValidator";
import { getTransactionsPage, countPending } from "@/lib/transactions/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getPurchaseOptions } from "@/lib/purchases/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { getRecurringOptions } from "@/lib/recurring/queries";
import { getPersonOptions } from "@/lib/persons/queries";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const [
    data,
    pendingCount,
    subcategoryOptions,
    purchaseOptions,
    merchantOptions,
    recurringOptions,
    personOptions,
  ] = await Promise.all([
    getTransactionsPage({ status: "pending", perPage: 200, sort: "date_desc" }),
    countPending(),
    getSubcategoryOptions(),
    getPurchaseOptions(),
    getMerchantOptions(),
    getRecurringOptions(),
    getPersonOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="À valider"
        subtitle="Catégorise les transactions en attente et crée des règles."
      />
      <Suspense>
        <TransactionsTabs pendingCount={pendingCount} />
      </Suspense>
      <PendingValidator
        rows={data.rows}
        subcategoryOptions={subcategoryOptions}
        purchaseOptions={purchaseOptions}
        merchantOptions={merchantOptions}
        recurringOptions={recurringOptions}
        personOptions={personOptions}
      />
    </>
  );
}
