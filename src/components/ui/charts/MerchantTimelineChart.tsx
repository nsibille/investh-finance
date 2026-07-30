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
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/format/currency";

export interface TimelinePoint {
  /** Clé stable (YYYY-MM ou YYYY-MM-DD). */
  key: string;
  /** Libellé d'axe (« janv. » ou « 12 »). */
  label: string;
  /** Sous-libellé de tooltip (année, ou mois complet). */
  sub?: string;
  /** Flux de l'enseigne. */
  amount: number;
  count: number;
  /** Reste de la catégorie directe (catégorie − enseigne) ce mois. */
  restCategory?: number;
  /** Reste du type (type − catégorie) ce mois. */
  restType?: number;
}

/** Contexte de ventilation : libellés des parents empilés au-dessus de l'enseigne. */
export interface TimelineStack {
  categoryLabel: string;
  typeLabel: string;
}

const REST_CAT_COLOR = "var(--color-text-muted)";
const REST_TYPE_COLOR = "var(--color-border-strong)";

interface TooltipEntry {
  payload: TimelinePoint;
}

function ChartTooltip({
  active,
  payload,
  valueLabel,
  stack,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  valueLabel: string;
  stack?: TimelineStack;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const catTotal = p.amount + (p.restCategory ?? 0);
  const typeTotal = catTotal + (p.restType ?? 0);
  const share = (part: number, whole: number) =>
    whole > 0 ? ` · ${Math.round((part / whole) * 100)} %` : "";
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__title">
        {p.label}
        {p.sub ? ` ${p.sub}` : ""}
      </span>
      <span className="chart-tooltip__row">
        <span className="chart-tooltip__label">
          <span className="chart-tooltip__swatch" style={{ background: "var(--tt-accent)" }} />
          {stack ? "Cette enseigne" : valueLabel}
        </span>
        <span className="chart-tooltip__value">
          {formatCurrency(p.amount)}
          {stack ? share(p.amount, catTotal) : ""}
        </span>
      </span>
      {stack && (
        <>
          <span className="chart-tooltip__row">
            <span className="chart-tooltip__label">
              <span className="chart-tooltip__swatch" style={{ background: REST_CAT_COLOR, opacity: 0.5 }} />
              Catégorie {stack.categoryLabel}
            </span>
            <span className="chart-tooltip__value">{formatCurrency(catTotal)}</span>
          </span>
          {typeTotal - catTotal > 0.005 && (
            <span className="chart-tooltip__row">
              <span className="chart-tooltip__label">
                <span className="chart-tooltip__swatch" style={{ background: REST_TYPE_COLOR, opacity: 0.6 }} />
                Type {stack.typeLabel}
              </span>
              <span className="chart-tooltip__value">
                {formatCurrency(typeTotal)}
                {share(p.amount, typeTotal)}
              </span>
            </span>
          )}
        </>
      )}
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
 *
 * Avec `stack`, les parents (reste de la catégorie, puis reste du type) sont
 * empilés au-dessus de la barre de l'enseigne pour visualiser la ventilation :
 * la part colorée = l'enseigne, le total empilé = le type.
 */
export function MerchantTimelineChart({
  data,
  average = 0,
  valueLabel = "Dépenses",
  selectedKey,
  accent = "var(--color-brand-primary)",
  height = 300,
  stack,
  onSelect,
}: {
  data: TimelinePoint[];
  average?: number;
  valueLabel?: string;
  /** Barre mise en relief (les autres atténuées). */
  selectedKey?: string | null;
  accent?: string;
  height?: number;
  /** Active l'empilement des parents (ventilation). */
  stack?: TimelineStack;
  onSelect?: (point: TimelinePoint) => void;
}) {
  const max = stack
    ? Math.max(0, ...data.map((d) => d.amount + (d.restCategory ?? 0) + (d.restType ?? 0)))
    : Math.max(0, ...data.map((d) => d.amount));
  const hasSelection = selectedKey != null;
  const dim = (d: TimelinePoint) =>
    !hasSelection ? 1 : d.key === selectedKey ? 1 : 0.32;

  const handleClick = (_: unknown, index: number) => {
    const d = data[index];
    if (d && d.count > 0) onSelect?.(d);
  };
  const cursor = onSelect ? "pointer" : "default";

  // N'empile que les parents ayant un « reste » réel (évite une légende vide).
  const showRestCat = !!stack && data.some((d) => (d.restCategory ?? 0) > 0.005);
  const showRestType = !!stack && data.some((d) => (d.restType ?? 0) > 0.005);

  return (
    <div style={{ width: "100%", height, ["--tt-accent" as string]: accent }}>
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
            content={<ChartTooltip valueLabel={valueLabel} stack={stack} />}
          />
          {(showRestCat || showRestType) && <Legend wrapperStyle={{ fontSize: 11 }} />}

          {/* Barre de l'enseigne (base de la pile). */}
          <Bar
            dataKey="amount"
            name="Cette enseigne"
            stackId="v"
            radius={showRestCat || showRestType ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            maxBarSize={data.length > 15 ? 18 : 30}
            onClick={handleClick}
            style={{ cursor }}
          >
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={
                  !stack && d.amount > 0 && d.amount === max
                    ? accent
                    : "url(#merchant-timeline-fill)"
                }
                fillOpacity={dim(d)}
              />
            ))}
          </Bar>

          {showRestCat && stack && (
            <Bar
              dataKey="restCategory"
              name={`Reste ${stack.categoryLabel}`}
              stackId="v"
              fill={REST_CAT_COLOR}
              radius={showRestType ? [0, 0, 0, 0] : [3, 3, 0, 0]}
              maxBarSize={30}
              onClick={handleClick}
              style={{ cursor }}
            >
              {data.map((d) => (
                <Cell key={d.key} fillOpacity={0.42 * dim(d)} />
              ))}
            </Bar>
          )}
          {showRestType && stack && (
            <Bar
              dataKey="restType"
              name={`Reste ${stack.typeLabel}`}
              stackId="v"
              fill={REST_TYPE_COLOR}
              radius={[3, 3, 0, 0]}
              maxBarSize={30}
              onClick={handleClick}
              style={{ cursor }}
            >
              {data.map((d) => (
                <Cell key={d.key} fillOpacity={0.6 * dim(d)} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
