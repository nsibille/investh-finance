"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface NetWorthPoint {
  month: string;
  total: number;
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  return (
    <div
      className="chart-net-worth-evolution"
      style={{ width: "100%", height: 300 }}
    >
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => formatCompactCurrency(v)} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={70} />
          <RTooltip formatter={(value: unknown) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", fontSize: "var(--text-xs)" }} />
          <Line type="monotone" dataKey="total" name="Patrimoine" stroke="var(--color-brand-primary)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
