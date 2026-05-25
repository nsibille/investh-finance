"use client";

import { useRouter } from "next/navigation";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { AccountAvatar } from "@/components/ui/Avatar";
import { Amount } from "@/components/ui/Amount";
import { CountBadge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounts/constants";
import type { AccountWithBalance } from "@/lib/accounts/types";

interface AccountCardProps {
  account: AccountWithBalance;
  onEdit: (account: AccountWithBalance) => void;
  onToggleArchive: (account: AccountWithBalance) => void;
}

export function AccountCard({
  account,
  onEdit,
  onToggleArchive,
}: AccountCardProps) {
  const router = useRouter();
  const meta = [ACCOUNT_TYPE_LABELS[account.type], account.bank]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="card-account"
      style={{ cursor: "pointer", opacity: account.is_archived ? 0.6 : 1 }}
      onClick={() => router.push(`/accounts/${account.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/accounts/${account.id}`);
      }}
    >
      <AccountAvatar type={account.type} color={account.color} />
      <div className="card-account__body">
        <span className="card-account__name">{account.name}</span>
        <span className="card-account__meta">{meta}</span>
        <Amount value={account.current_balance} size="lg" tone="neutral" />
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {account.pending_count > 0 && (
          <CountBadge count={account.pending_count} />
        )}
        <IconButton label="Modifier" onClick={() => onEdit(account)}>
          <Pencil size={16} aria-hidden />
        </IconButton>
        <IconButton
          label={account.is_archived ? "Désarchiver" : "Archiver"}
          onClick={() => onToggleArchive(account)}
        >
          {account.is_archived ? (
            <ArchiveRestore size={16} aria-hidden />
          ) : (
            <Archive size={16} aria-hidden />
          )}
        </IconButton>
      </div>
    </div>
  );
}
