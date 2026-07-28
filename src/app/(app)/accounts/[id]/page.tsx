import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { AccountAvatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { AccountDetailActions } from "@/components/accounts/AccountDetailActions";
import { AccountRebases } from "@/components/accounts/AccountRebases";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounts/constants";
import { getAccount, getAccountRebases } from "@/lib/accounts/queries";
import { formatShortDate } from "@/lib/format/date";

export const dynamic = "force-dynamic";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {label}
        </span>
        {children}
      </div>
    </Card>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [account, rebases] = await Promise.all([
    getAccount(id),
    getAccountRebases(id),
  ]);

  if (!account) notFound();

  return (
    <>
      <Breadcrumb
        items={[{ label: "Comptes", href: "/accounts" }, { label: account.name }]}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          margin: "var(--space-4) 0 var(--space-6)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
          <AccountAvatar type={account.type} color={account.color} />
          <div>
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "var(--tracking-tight)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              {account.name}
              {account.is_archived && <StatusBadge status="ignored" />}
            </h1>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-1)",
              }}
            >
              {[ACCOUNT_TYPE_LABELS[account.type], account.bank]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <AccountDetailActions account={account} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        <Stat label="Solde courant">
          <Amount value={account.current_balance} size="xl" tone="neutral" />
        </Stat>
        <Stat label={`Solde initial (${formatShortDate(account.initial_date)})`}>
          <Amount value={account.initial_balance} size="lg" tone="neutral" />
        </Stat>
        <Stat label="Mouvements depuis l'ancrage (à ce jour)">
          <Amount value={account.transactions_sum} size="lg" />
        </Stat>
        <Stat label="En attente de validation">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xl)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            {account.pending_count}
          </span>
        </Stat>
      </div>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <AccountRebases accountId={account.id} rebases={rebases} />
      </div>

      <ComingSoon feature="L'historique des transactions du compte" />
    </>
  );
}
