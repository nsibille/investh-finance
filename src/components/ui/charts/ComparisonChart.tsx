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

export interface ComparisonRow {
  category: string;
  current: number;
  previous: number;
  average: number;
}

export function ComparisonChart({ data }: { data: ComparisonRow[] }) {
  return (
    <div className="chart-comparison" style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatCompactCurrency(v)} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={70} />
          <RTooltip formatter={(value: unknown) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--text-xs)" }} />
          <Legend />
          <Bar dataKey="current" name="Ce mois" fill="var(--color-brand-primary)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="previous" name="Mois préc." fill="var(--color-brand-primary-300)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="average" name="Moy. 12 mois" fill="var(--color-text-disabled)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
