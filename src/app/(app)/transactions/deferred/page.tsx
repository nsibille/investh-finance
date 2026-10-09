import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { DeferredReconciliation } from "@/components/transactions/DeferredReconciliation";
import { countPending } from "@/lib/transactions/queries";
import { countTransferOrphans } from "@/lib/transactions/transfersReconciliation";
import { getDeferredReconciliation } from "@/lib/transactions/deferredReconciliation";

export const dynamic = "force-dynamic";

export default async function DeferredPage() {
  const [reconciliation, pendingCount, transferAlerts] = await Promise.all([
    getDeferredReconciliation(),
    countPending(),
    countTransferOrphans(),
  ]);

  return (
    <>
      <PageHeader
        title="Débits différés"
        subtitle="Chaque mois de paiements carte doit avoir son prélèvement « débit différé » : le total des paiements doit égaler le montant prélevé."
      />
      <Suspense>
        <TransactionsTabs pendingCount={pendingCount} transferAlerts={transferAlerts} />
      </Suspense>
      <DeferredReconciliation data={reconciliation} />
    </>
  );
}
