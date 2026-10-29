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

/** The cap engine's rule: the lowest cap under the tolerance whose next-higher cap is too
 * (none if even 100% is over the tolerance) */
function lowestSafe(data: { cap: number; added_pct: number }[], tol: number): number | null {
  if (!data.length || data[0].added_pct > tol) return null; // over the tolerance even at 100%
  let best: number | null = null;
  data.forEach((d, i) => {
    if (d.added_pct <= tol && (i === 0 || data[i - 1].added_pct <= tol)) best = d.cap;
  });
  return best;
}

/** One line saying how the suggestion comes from this chart */
function howSuggested(row: CapRow, lowest: number | null): string | null {
  if (lowest == null) return null;
  const suggested = row.suggested_cap;
  const buffer = suggested - lowest;
  return buffer > 0
    ? `Lowest safe ${lowest}% + ${buffer}% buffer = suggested ${suggested}%.`
    : `Lowest safe ${lowest}% = suggested ${suggested}%.`;
}

export default function SweepChart({ row }: { row: CapRow }) {
  const sweep = row.sweep ?? [];
  const tol = row.tolerance_pct ?? 5;
  if (sweep.length === 0)
    return <p className="text-sm text-slate-500">No sweep evidence stored for this vehicle.</p>;
  const data = [...sweep].sort((a, b) => b.cap - a.cap);
  const lowest = lowestSafe(data, tol);
  const how = howSuggested(row, lowest);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        Extra top-up days added by each cap (backtest) — tolerance {tol}%
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
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
          {lowest != null && (
            <ReferenceLine
              x={lowest}
              stroke="#475569"
              strokeDasharray="3 3"
              label={{ value: "lowest safe", fontSize: 10, fill: "#334155", position: "top" }}
            />
          )}
          <Bar dataKey="added_pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d) => (
              <Cell key={d.cap} fill={d.added_pct > tol ? "#b91c1c" : "#0e7490"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {how && <p className="mt-2 text-sm font-medium text-slate-800">{how}</p>}
      <p className="mt-1 text-sm text-slate-600">{row.note}</p>
    </div>
  );
}
