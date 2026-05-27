import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PdfImport } from "@/components/import/PdfImport";
import { BankConnectionsManager } from "@/components/import/BankConnectionsManager";
import { getBankConnections } from "@/lib/bank/queries";
import { getAccountOptions } from "@/lib/rules/queries";
import { isGoCardlessConfigured } from "@/lib/gocardless/client";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "var(--text-lg)",
        fontWeight: "var(--fw-semibold)",
        margin: "var(--space-8) 0 var(--space-4)",
      }}
    >
      {children}
    </h2>
  );
}

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
        subtitle="Importe un relevé PDF ou connecte une banque pour synchroniser."
      />

      <SectionTitle>Import de relevé PDF</SectionTitle>
      <PdfImport accountOptions={accountOptions} />

      <SectionTitle>Connexions bancaires (GoCardless)</SectionTitle>
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
