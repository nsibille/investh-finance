import { PageHeader } from "@/components/layout/PageHeader";
import { AccountsManager } from "@/components/accounts/AccountsManager";
import { getAccountsWithBalances } from "@/lib/accounts/queries";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAccountsWithBalances();

  return (
    <>
      <PageHeader
        title="Comptes"
        subtitle="Gère tes comptes et suis leurs soldes consolidés."
      />
      <AccountsManager accounts={accounts} />
    </>
  );
}
