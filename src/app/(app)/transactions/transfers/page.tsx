import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { TransferReconciliation } from "@/components/transactions/TransferReconciliation";
import { countPending } from "@/lib/transactions/queries";
import { getTransferReconciliation } from "@/lib/transactions/transfersReconciliation";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const [reconciliation, pendingCount] = await Promise.all([
    getTransferReconciliation(),
    countPending(),
  ]);

  const alerts = reconciliation.orphans.length;

  return (
    <>
      <PageHeader
        title="Virements internes"
        subtitle="Réconcilie les virements entre tes comptes : chaque sortie doit avoir son entrée, le total doit faire 0."
      />
      <Suspense>
        <TransactionsTabs pendingCount={pendingCount} transferAlerts={alerts} />
      </Suspense>
      <TransferReconciliation data={reconciliation} />
    </>
  );
}
