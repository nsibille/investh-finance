"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface MonthlyBar {
  month: string;
  revenus: number;
  depenses: number;
}

export function BarMonthly({ data }: { data: MonthlyBar[] }) {
  return (
    <div className="chart-bar-monthly" style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <RTooltip
            formatter={(value: unknown) => formatCurrency(Number(value))}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
            }}
          />
          <Legend />
          <Bar dataKey="revenus" name="Revenus" fill="var(--color-finance-revenus)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="depenses" name="Dépenses" fill="var(--color-finance-depenses)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
