"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BacktestMonth } from "@/lib/api";

const ACTUAL = "#94a3b8";
const WITH_SUGGESTIONS = "#0e7490";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03" → "Mar 26" */
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** Public charging per month: what happened vs what was left after our charging suggestions */
export default function BacktestChart({ monthly }: { monthly: BacktestMonth[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        Public charging per month (kWh)
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => Number(v).toLocaleString("en-IN")}
          />
          <Tooltip
            labelFormatter={(l) => monthLabel(String(l))}
            formatter={(v) => `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} kWh`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} />
          <Bar
            dataKey="public_kwh"
            name="Actual"
            fill={ACTUAL}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
          <Bar
            dataKey="public_after_kwh"
            name="With our charging suggestions"
            fill={WITH_SUGGESTIONS}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
