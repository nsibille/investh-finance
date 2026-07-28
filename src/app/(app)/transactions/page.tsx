import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionsManager } from "@/components/transactions/TransactionsManager";
import { ExportMenu } from "@/components/transactions/ExportMenu";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTransactionsPage, countPending } from "@/lib/transactions/queries";
import { countTransferOrphans } from "@/lib/transactions/transfersReconciliation";
import { getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getPurchaseOptions } from "@/lib/purchases/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
import { getRecurringOptions } from "@/lib/recurring/queries";
import { getPersonOptions } from "@/lib/persons/queries";
import type { TransactionStatus } from "@/lib/transactions/types";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "validated", "ignored"] as const;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as TransactionStatus)
    ? (sp.status as TransactionStatus)
    : undefined;
  const parseList = (v?: string) => (v ? v.split(",").filter(Boolean) : undefined);
  // Filtre par magnitude : on accepte un montant signé (tel qu'affiché) et on
  // applique sa valeur absolue.
  const parseAmount = (v?: string) => {
    const n = Number(v);
    return v && Number.isFinite(n) ? Math.abs(n) : undefined;
  };

  const [
    data,
    pendingCount,
    transferAlerts,
    accountOptions,
    subcategoryOptions,
    purchaseOptions,
    merchantOptions,
    recurringOptions,
    personOptions,
  ] = await Promise.all([
    getTransactionsPage({
      accountId: sp.account,
      status,
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
      page: Number(sp.page) || 1,
    }),
    countPending(),
    countTransferOrphans(),
    getAccountOptions(),
    getSubcategoryOptions(),
    getPurchaseOptions(),
    getMerchantOptions(),
    getRecurringOptions(),
    getPersonOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Filtre, catégorise et valide tes opérations."
        actions={
          <Suspense>
            <ExportMenu />
          </Suspense>
        }
      />
      <Suspense>
        <TransactionsTabs pendingCount={pendingCount} transferAlerts={transferAlerts} />
        <TransactionFilters
          accountOptions={accountOptions}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          purchaseOptions={purchaseOptions}
        />
        {data.rows.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucune transaction"
              description="Ajuste les filtres ou importe un relevé pour commencer."
            />
          </Card>
        ) : (
          <TransactionsManager
            rows={data.rows}
            total={data.total}
            page={data.page}
            perPage={data.perPage}
            subcategoryOptions={subcategoryOptions}
            purchaseOptions={purchaseOptions}
            merchantOptions={merchantOptions}
            recurringOptions={recurringOptions}
            personOptions={personOptions}
          />
        )}
      </Suspense>
    </>
  );
}
