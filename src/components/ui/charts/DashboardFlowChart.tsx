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
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface FlowChartPoint {
  month: string; // clé YYYY-MM
  label: string; // « janv. »
  revenus: number;
  depenses: number;
  investissements: number;
}

/**
 * Graphe mensuel 3 flux (revenus / dépenses / investissements) sur l'année
 * glissante. Le mois zoomé, s'il y en a un, est mis en relief (les autres sont
 * atténués).
 */
export function DashboardFlowChart({
  data,
  highlightMonth,
}: {
  data: FlowChartPoint[];
  highlightMonth?: string | null;
}) {
  const dim = (month: string) => (highlightMonth && month !== highlightMonth ? 0.35 : 1);
  const series: { key: "revenus" | "depenses" | "investissements"; name: string; color: string }[] = [
    { key: "revenus", name: "Revenus", color: "var(--color-finance-revenus)" },
    { key: "depenses", name: "Dépenses", color: "var(--color-finance-depenses)" },
    { key: "investissements", name: "Investissements", color: "var(--color-finance-investissement)" },
  ];

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <RTooltip
            formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value)), String(name)]}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
              boxShadow: "var(--shadow-md)",
            }}
          />
          <Legend />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={22}>
              {data.map((d) => (
                <Cell key={d.month} fillOpacity={dim(d.month)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
