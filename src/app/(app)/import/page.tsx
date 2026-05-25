import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BankConnectionsManager } from "@/components/import/BankConnectionsManager";
import { getBankConnections } from "@/lib/bank/queries";
import { getAccountOptions } from "@/lib/rules/queries";
import { isGoCardlessConfigured } from "@/lib/gocardless/client";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [connections, accountOptions] = await Promise.all([
    getBankConnections(),
    getAccountOptions(),
  ]);
  const configured = isGoCardlessConfigured();

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Connecte tes banques via GoCardless et synchronise tes transactions."
      />
      <Suspense>
        <BankConnectionsManager
          connections={connections}
          accountOptions={accountOptions}
          configured={configured}
        />
      </Suspense>
    </>
  );
}
