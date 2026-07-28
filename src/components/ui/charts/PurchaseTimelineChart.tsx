"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface PurchaseTimelinePoint {
  /** Libellé court du mois (ex. « janv. »). */
  label: string;
  year: number;
  amount: number;
  /** true = échéance prévisionnelle non encore réglée. */
  upcoming: boolean;
}

/**
 * Graphe des paiements d'un achat dans le temps — une barre par mois/échéance,
 * teinte brand foncée pour le payé, claire pour les échéances à venir. Tooltip
 * au survol.
 */
export function PurchaseTimelineChart({ data }: { data: PurchaseTimelinePoint[] }) {
  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <RTooltip
            cursor={{ fill: "var(--color-brand-primary-50)" }}
            formatter={(value: unknown, _n: unknown, item: { payload?: PurchaseTimelinePoint }) => [
              formatCurrency(Number(value)),
              item?.payload?.upcoming ? "À venir" : "Payé",
            ]}
            labelFormatter={(label, payload) => {
              const year = (payload?.[0]?.payload as { year?: number } | undefined)?.year;
              return year ? `${String(label)} ${year}` : String(label ?? "");
            }}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
              boxShadow: "var(--shadow-md)",
            }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={26}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.upcoming ? "var(--color-brand-primary-200)" : "var(--color-brand-primary)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
