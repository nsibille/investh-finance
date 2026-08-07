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
  /** Flux de l'entité. */
  amount: number;
  count: number;
  /** « Restes » cumulés des parents (aligné à `stack.levels`). */
  rests?: number[];
}

/** Contexte de ventilation : libellés des parents empilés au-dessus de l'entité. */
export interface TimelineStack {
  levels: { label: string }[];
}

/** Palette des segments « reste » par profondeur de parent (du plus proche au plus large). */
const REST_COLORS = ["var(--color-text-muted)", "var(--color-border-strong)"];

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
  const rests = p.rests ?? [];
  // Totaux cumulés par niveau (entité, puis chaque parent).
  const cumul: number[] = [];
  let acc = p.amount;
  for (const r of rests) {
    acc += r;
    cumul.push(acc);
  }
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
          {stack ? "Cette entité" : valueLabel}
        </span>
        <span className="chart-tooltip__value">
          {formatCurrency(p.amount)}
          {stack && cumul.length ? share(p.amount, cumul[cumul.length - 1]) : ""}
        </span>
      </span>
      {stack?.levels.map((lvl, i) =>
        cumul[i] - p.amount > 0.005 || rests[i] > 0.005 ? (
          <span key={lvl.label} className="chart-tooltip__row">
            <span className="chart-tooltip__label">
              <span
                className="chart-tooltip__swatch"
                style={{ background: REST_COLORS[i] ?? REST_COLORS[REST_COLORS.length - 1], opacity: 0.55 }}
              />
              {lvl.label}
            </span>
            <span className="chart-tooltip__value">{formatCurrency(cumul[i])}</span>
          </span>
        ) : null,
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
 * Histogramme temporel d'une entité (enseigne ou catégorie), mensuel ou
 * journalier. Lecture soignée : grille horizontale, axe compact, ligne de
 * moyenne repérée, barre sélectionnée en relief, tooltip riche (montant + nb
 * d'opérations). Barres cliquables (`onSelect`) pour le look-through.
 *
 * Avec `stack`, les parents (cumulatifs, du plus proche au plus large) sont
 * empilés au-dessus de la barre de l'entité pour visualiser la ventilation : la
 * part colorée = l'entité, le total empilé = le parent le plus large.
 */
export function EntityTimelineChart({
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
  selectedKey?: string | null;
  accent?: string;
  height?: number;
  stack?: TimelineStack;
  onSelect?: (point: TimelinePoint) => void;
}) {
  const totalOf = (d: TimelinePoint) =>
    d.amount + (d.rests?.reduce((s, r) => s + r, 0) ?? 0);
  const max = stack
    ? Math.max(0, ...data.map(totalOf))
    : Math.max(0, ...data.map((d) => d.amount));
  const hasSelection = selectedKey != null;
  const dim = (d: TimelinePoint) =>
    !hasSelection ? 1 : d.key === selectedKey ? 1 : 0.32;

  const handleClick = (_: unknown, index: number) => {
    const d = data[index];
    if (d && d.count > 0) onSelect?.(d);
  };
  const cursor = onSelect ? "pointer" : "default";

  // Niveaux réellement présents (au moins un « reste » non nul) → évite une légende vide.
  const shownLevels = stack
    ? stack.levels
        .map((lvl, i) => ({ lvl, i }))
        .filter(({ i }) => data.some((d) => (d.rests?.[i] ?? 0) > 0.005))
    : [];
  const lastShownIdx = shownLevels.length ? shownLevels[shownLevels.length - 1].i : -1;

  return (
    <div style={{ width: "100%", height, ["--tt-accent" as string]: accent }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <defs>
            <linearGradient id="entity-timeline-fill" x1="0" y1="0" x2="0" y2="1">
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
          {shownLevels.length > 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}

          {/* Barre de l'entité (base de la pile). */}
          <Bar
            dataKey="amount"
            name="Cette entité"
            stackId="v"
            radius={shownLevels.length ? [0, 0, 0, 0] : [4, 4, 0, 0]}
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
                    : "url(#entity-timeline-fill)"
                }
                fillOpacity={dim(d)}
              />
            ))}
          </Bar>

          {shownLevels.map(({ lvl, i }) => (
            <Bar
              key={lvl.label}
              dataKey={(d: TimelinePoint) => d.rests?.[i] ?? 0}
              name={lvl.label}
              stackId="v"
              fill={REST_COLORS[i] ?? REST_COLORS[REST_COLORS.length - 1]}
              radius={i === lastShownIdx ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={30}
              onClick={handleClick}
              style={{ cursor }}
            >
              {data.map((d) => (
                <Cell key={d.key} fillOpacity={(0.42 + i * 0.18) * dim(d)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
