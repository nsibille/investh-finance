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
  ReferenceLine,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface MerchantSpendPoint {
  /** Libellé court du mois (ex. « janv. »). */
  label: string;
  /** Année du mois (pour le tooltip). */
  year: number;
  depenses: number;
}

/**
 * Graphe des dépenses d'une enseigne sur 12 mois — série unique (dépenses),
 * teinte brand, tops arrondis, ligne de moyenne mensuelle en pointillés et
 * tooltip au survol. Le mois le plus dépensier est mis en relief.
 */
export function MerchantSpendChart({
  data,
  average,
}: {
  data: MerchantSpendPoint[];
  average: number;
}) {
  const max = Math.max(0, ...data.map((d) => d.depenses));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="merchant-spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
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
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <RTooltip
            cursor={{ fill: "var(--color-brand-primary-50)" }}
            formatter={(value: unknown) => [formatCurrency(Number(value)), "Dépenses"]}
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
          <Bar dataKey="depenses" name="Dépenses" radius={[4, 4, 0, 0]} maxBarSize={26}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.depenses > 0 && d.depenses === max
                    ? "var(--color-brand-primary-700)"
                    : "url(#merchant-spend-fill)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
