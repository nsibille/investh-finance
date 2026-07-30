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

export interface TimelinePoint {
  /** Clé stable (YYYY-MM ou YYYY-MM-DD). */
  key: string;
  /** Libellé d'axe (« janv. » ou « 12 »). */
  label: string;
  /** Sous-libellé de tooltip (année, ou mois complet). */
  sub?: string;
  amount: number;
  count: number;
}

interface TooltipEntry {
  payload: TimelinePoint;
}

function ChartTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__title">
        {p.label}
        {p.sub ? ` ${p.sub}` : ""}
      </span>
      <span className="chart-tooltip__row">
        <span className="chart-tooltip__label">{valueLabel}</span>
        <span className="chart-tooltip__value">{formatCurrency(p.amount)}</span>
      </span>
      <span className="chart-tooltip__row">
        <span className="chart-tooltip__label">Opérations</span>
        <span className="chart-tooltip__value">{p.count}</span>
      </span>
      {p.count > 0 && (
        <span className="chart-tooltip__hint">Cliquer pour le détail →</span>
      )}
    </div>
  );
}

/**
 * Histogramme d'une enseigne (mensuel ou journalier). Lecture soignée : grille
 * horizontale, axe des montants compact, ligne de moyenne repérée, barre
 * sélectionnée en relief (les autres atténuées), tooltip riche (montant + nb
 * d'opérations). Cliquer une barre déclenche le look-through (`onSelect`).
 */
export function MerchantTimelineChart({
  data,
  average = 0,
  valueLabel = "Dépenses",
  selectedKey,
  accent = "var(--color-brand-primary)",
  height = 300,
  onSelect,
}: {
  data: TimelinePoint[];
  average?: number;
  valueLabel?: string;
  /** Barre mise en relief (les autres atténuées). */
  selectedKey?: string | null;
  accent?: string;
  height?: number;
  onSelect?: (point: TimelinePoint) => void;
}) {
  const max = Math.max(0, ...data.map((d) => d.amount));
  const hasSelection = selectedKey != null;
  const opacityOf = (d: TimelinePoint) =>
    !hasSelection ? 1 : d.key === selectedKey ? 1 : 0.32;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <defs>
            <linearGradient id="merchant-timeline-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.95} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCurrency(v)}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `moy. ${formatCompactCurrency(average)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "var(--color-text-muted)",
              }}
            />
          )}
          <RTooltip
            cursor={{ fill: "var(--color-brand-primary-50)" }}
            content={<ChartTooltip valueLabel={valueLabel} />}
          />
          <Bar
            dataKey="amount"
            radius={[4, 4, 0, 0]}
            maxBarSize={data.length > 15 ? 18 : 30}
            onClick={(_: unknown, index: number) => {
              const d = data[index];
              if (d && d.count > 0) onSelect?.(d);
            }}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={
                  d.amount > 0 && d.amount === max
                    ? accent
                    : "url(#merchant-timeline-fill)"
                }
                fillOpacity={opacityOf(d)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
