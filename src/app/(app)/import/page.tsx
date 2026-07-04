import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatementImport } from "@/components/import/StatementImport";
import { BankConnectionsManager } from "@/components/import/BankConnectionsManager";
import { getBankConnections } from "@/lib/bank/queries";
import { getAccountOptions } from "@/lib/rules/queries";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { getPurchaseOptions } from "@/lib/purchases/queries";
import { getMerchantOptions } from "@/lib/merchants/queries";
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
  const [
    connections,
    accountOptions,
    subcategoryOptions,
    purchaseOptions,
    merchantOptions,
  ] = await Promise.all([
    getBankConnections(),
    getAccountOptions(),
    getSubcategoryOptions(),
    getPurchaseOptions(),
    getMerchantOptions(),
  ]);
  const configured = isGoCardlessConfigured();

  return (
    <>
      <PageHeader
        title="Import"
        subtitle="Importe un relevé PDF, un export CSV ou connecte une banque pour synchroniser."
      />

      <SectionTitle>Import de relevé (PDF ou CSV)</SectionTitle>
      <StatementImport
        accountOptions={accountOptions}
        subcategoryOptions={subcategoryOptions}
        purchaseOptions={purchaseOptions}
        merchantOptions={merchantOptions}
      />

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
