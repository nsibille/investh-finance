import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { PendingValidator } from "@/components/transactions/PendingValidator";
import { getTransactionsPage, countPending } from "@/lib/transactions/queries";
import { getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getPurchaseOptions } from "@/lib/purchases/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { getRecurringOptions } from "@/lib/recurring/queries";
import { getPersonOptions } from "@/lib/persons/queries";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parseList = (v?: string) => (v ? v.split(",").filter(Boolean) : undefined);
  const parseAmount = (v?: string) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const [
    data,
    pendingCount,
    accountOptions,
    subcategoryOptions,
    purchaseOptions,
    merchantOptions,
    recurringOptions,
    personOptions,
  ] = await Promise.all([
    getTransactionsPage({
      status: "pending",
      accountId: sp.account,
      subcategoryId: sp.subcategory,
      merchantIds: parseList(sp.merchant),
      purchaseIds: parseList(sp.purchase),
      amountMin: parseAmount(sp.amin),
      amountMax: parseAmount(sp.amax),
      search: sp.q,
      from: sp.from,
      to: sp.to,
      sort: sp.sort as
        | "date_desc"
        | "date_asc"
        | "amount_desc"
        | "amount_asc"
        | undefined,
      perPage: 200,
    }),
    countPending(),
    getAccountOptions(),
    getSubcategoryOptions(),
    getPurchaseOptions(),
    getMerchantOptions(),
    getRecurringOptions(),
    getPersonOptions(),
  ]);

  // Signature des filtres : force le remontage de PendingValidator quand la
  // liste change, pour réinitialiser proprement son état optimiste local.
  const filterKey = JSON.stringify(sp);

  return (
    <>
      <PageHeader
        title="À valider"
        subtitle="Catégorise les transactions en attente et crée des règles."
      />
      <Suspense>
        <TransactionsTabs pendingCount={pendingCount} />
        <TransactionFilters
          accountOptions={accountOptions}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          purchaseOptions={purchaseOptions}
          showStatus={false}
        />
      </Suspense>
      <PendingValidator
        key={filterKey}
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
