import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

type Kind = "revenus" | "depenses" | "solde" | "epargne";

interface KpiCardProps {
  kind: Kind;
  label: string;
  value: string;
  /** Variation en % vs mois précédent. */
  deltaPercent?: number | null;
}

export function KpiCard({ kind, label, value, deltaPercent }: KpiCardProps) {
  const direction =
    deltaPercent == null
      ? null
      : deltaPercent > 0
        ? "up"
        : deltaPercent < 0
          ? "down"
          : "flat";

  const DeltaIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <div className={`card-kpi card-kpi-${kind}`}>
      <span className="card-kpi__label">{label}</span>
      <span className="card-kpi__value">{value}</span>
      {direction && (
        <span className="card-kpi__delta" data-direction={direction}>
          <DeltaIcon size={14} aria-hidden />
          {deltaPercent != null &&
            `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)} %`}
        </span>
      )}
    </div>
  );
}
