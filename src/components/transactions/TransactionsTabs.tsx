"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge } from "@/components/ui/Badge";

export function TransactionsTabs({
  pendingCount,
  transferAlerts = 0,
}: {
  pendingCount: number;
  transferAlerts?: number;
}) {
  const pathname = usePathname();
  const isPending = pathname.startsWith("/transactions/pending");
  const isTransfers = pathname.startsWith("/transactions/transfers");
  const isAll = !isPending && !isTransfers;

  return (
    <div className="nav-tabs" style={{ marginBottom: "var(--space-5)" }}>
      <Link href="/transactions" className="nav-tabs-item" data-active={isAll}>
        Toutes
      </Link>
      <Link
        href="/transactions/pending"
        className="nav-tabs-item"
        data-active={isPending}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        À valider
        {pendingCount > 0 && <CountBadge count={pendingCount} />}
      </Link>
      <Link
        href="/transactions/transfers"
        className="nav-tabs-item"
        data-active={isTransfers}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        Virements
        {transferAlerts > 0 && <CountBadge count={transferAlerts} />}
      </Link>
    </div>
  );
}
