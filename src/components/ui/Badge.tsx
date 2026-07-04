import type { CSSProperties, ReactNode } from "react";
import { Repeat, AlertTriangle } from "lucide-react";
import type { Database } from "@/types/database.types";

type TxStatus = Database["public"]["Enums"]["transaction_status"];

const STATUS_LABELS: Record<TxStatus, string> = {
  pending: "À valider",
  validated: "Validée",
  ignored: "Ignorée",
};

export function StatusBadge({ status }: { status: TxStatus }) {
  return (
    <span className={`badge-status-${status}`}>{STATUS_LABELS[status]}</span>
  );
}

export function ImportRowBadge({
  kind,
}: {
  kind: "new" | "duplicate" | "duplicate-file";
}) {
  const label =
    kind === "new"
      ? "Nouvelle"
      : kind === "duplicate"
        ? "Doublon (en base)"
        : "Doublon (fichier)";
  return <span className={`badge-status-${kind}`}>{label}</span>;
}

export function CategoryBadge({
  name,
  color,
  onClick,
}: {
  name: string;
  color?: string | null;
  onClick?: () => void;
}) {
  const style = { "--category-color": color ?? undefined } as CSSProperties;
  return (
    <button type="button" className="badge-category" style={style} onClick={onClick}>
      {name}
    </button>
  );
}

export function TagBadge({ children }: { children: ReactNode }) {
  return <span className="badge-tag-md">{children}</span>;
}

export function RecurringBadge({ missing = false }: { missing?: boolean }) {
  if (missing) {
    return (
      <span className="badge-recurring-missing">
        <AlertTriangle size={12} aria-hidden />
        Manquante
      </span>
    );
  }
  return (
    <span className="badge-recurring-active">
      <Repeat size={12} aria-hidden />
      Active
    </span>
  );
}

export function CountBadge({ count }: { count: number }) {
  return <span className="badge-count">{count}</span>;
}

export function Dot({ color }: { color?: string }) {
  const style = { "--dot-color": color ?? undefined } as CSSProperties;
  return <span className="badge-dot" style={style} aria-hidden />;
}
