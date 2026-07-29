"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  ReferenceLine,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface TreasuryChartPoint {
  date: string; // YYYY-MM-DD
  balance: number;
}

const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
function monthTick(isoDate: string): string {
  const [, m] = isoDate.split("-");
  return MONTHS[Number(m) - 1] ?? isoDate;
}
function fullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/**
 * Courbe de trésorerie consolidée (solde global de tous les comptes) au jour le
 * jour sur la fenêtre choisie. Aire teintée brand, ligne de zéro en repère.
 */
export function TreasuryChart({ points }: { points: TreasuryChartPoint[] }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="treasury-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={monthTick}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeWidth={1} />
          <RTooltip
            formatter={(value: unknown) => [formatCurrency(Number(value)), "Trésorerie"]}
            labelFormatter={(label) => fullDate(String(label))}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
              boxShadow: "var(--shadow-md)",
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--color-brand-primary)"
            strokeWidth={2}
            fill="url(#treasury-fill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
