"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format/currency";

export interface PieSlice {
  name: string;
  value: number;
  color?: string;
}

const FALLBACK_COLORS = [
  "#5B5BD6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#F97316",
  "#71717A",
];

export function PieCategories({ data }: { data: PieSlice[] }) {
  return (
    <div className="chart-pie-categories" style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {data.map((slice, i) => (
              <Cell
                key={slice.name}
                fill={slice.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <RTooltip
            formatter={(value: unknown) => formatCurrency(Number(value))}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-xs)",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
