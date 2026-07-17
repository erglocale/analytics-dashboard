"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CapRow } from "@/lib/api";

export default function SweepChart({ row }: { row: CapRow }) {
  const sweep = row.sweep ?? [];
  const tol = row.tolerance_pct ?? 5;
  if (sweep.length === 0)
    return <p className="text-sm text-slate-500">No sweep evidence stored for this vehicle.</p>;
  const data = [...sweep].sort((a, b) => b.cap - a.cap);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        Extra top-up days added by each cap (backtest) — tolerance {tol}%
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="cap"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [`+${v}% unsafe days`, "added"]}
            labelFormatter={(l) => `Cap ${l}%`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          />
          <ReferenceLine
            y={tol}
            stroke="#b91c1c"
            strokeDasharray="4 3"
            label={{ value: "tolerance", fontSize: 10, fill: "#b91c1c", position: "insideTopRight" }}
          />
          <Bar dataKey="added_pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d) => (
              <Cell key={d.cap} fill={d.added_pct > tol ? "#b91c1c" : "#0e7490"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-sm text-slate-600">{row.note}</p>
    </div>
  );
}
