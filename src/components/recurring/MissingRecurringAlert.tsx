import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { RecurringPatternView } from "@/lib/recurring/queries";

export function MissingRecurringAlert({
  missing,
}: {
  missing: RecurringPatternView[];
}) {
  if (missing.length === 0) return null;
  return (
    <div className="alert-warning" role="alert">
      <AlertTriangle size={18} aria-hidden style={{ flexShrink: 0 }} />
      <span>
        {missing.length === 1
          ? `Une opération récurrente semble manquante : `
          : `${missing.length} opérations récurrentes semblent manquantes : `}
        {missing.map((m, i) => (
          <span key={m.id}>
            {i > 0 && ", "}
            <strong>{m.name}</strong>
          </span>
        ))}
        .{" "}
        <Link href="/recurring" style={{ color: "inherit", textDecoration: "underline" }}>
          Voir les récurrentes
        </Link>
      </span>
    </div>
  );
}
