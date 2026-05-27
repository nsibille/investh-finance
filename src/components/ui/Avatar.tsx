import {
  Landmark,
  PiggyBank,
  Home,
  Users,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/types/database.types";

type AccountType = Database["public"]["Enums"]["account_type"];

interface AvatarProps {
  email?: string;
  src?: string | null;
}

export function Avatar({ email = "", src }: AvatarProps) {
  return (
    <span className="avatar-md" title={email}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        (email.charAt(0).toUpperCase() || "?")
      )}
    </span>
  );
}

const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  pel: Home,
  joint: Users,
  investment: TrendingUp,
  other: Wallet,
};

export function AccountAvatar({
  type,
  color,
}: {
  type: AccountType;
  color?: string | null;
}) {
  const Icon = ACCOUNT_ICONS[type];
  return (
    <span
      className="avatar-md"
      style={{
        background: color ?? "var(--color-brand-primary)",
        color: "var(--color-text-on-brand)",
        width: 36,
        height: 36,
        borderRadius: "var(--radius-md)",
      }}
    >
      <Icon size={18} aria-hidden />
    </span>
  );
}
