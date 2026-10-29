"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BenefitRow } from "@/lib/api";

const FULL = "#94a3b8";
const CAP = "#0e7490";

type LabelProps = { index?: number; x?: number | string; y?: number | string };

/** Direct label at the line's last point only */
function endLabel(lastIndex: number, text: string, fill: string) {
  function EndLabel(p: LabelProps) {
    if (p.index !== lastIndex) return <g />;
    return (
      <text x={Number(p.x) + 6} y={Number(p.y) + 4} fontSize={11} fill={fill}>
        {text}
      </text>
    );
  }
  return EndLabel;
}

/** Battery capacity left, year by year: charging to 100 % vs to the cap. */
export default function BenefitChart({ row }: { row: BenefitRow }) {
  const data = [{ year: 0, full_pct: 100, cap_pct: 100 }, ...row.life];
  const last = data[data.length - 1];
  const capName = `Capped at ${row.suggested_cap}%`;
  const minY = Math.max(0, Math.floor(Math.min(last.full_pct, last.cap_pct) / 10) * 10 - 10);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        Battery capacity left over the years
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 120, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="year"
            tickFormatter={(v) => `${v}y`}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            domain={[minY, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            labelFormatter={(l) => `After ${l} year${l === 1 ? "" : "s"}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "#475569" }} />
          <ReferenceLine
            y={80}
            stroke="#64748b"
            strokeDasharray="2 3"
            label={{ value: "80% (typical end of life)", fontSize: 10, fill: "#475569", position: "insideBottomLeft" }}
          />
          <Line
            dataKey="full_pct"
            name="Charge to 100%"
            stroke={FULL}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            label={endLabel(data.length - 1, `${last.full_pct.toFixed(0)}% left at 100%`, "#475569")}
          />
          <Line
            dataKey="cap_pct"
            name={capName}
            stroke={CAP}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            label={endLabel(data.length - 1, `${last.cap_pct.toFixed(0)}% left at ${row.suggested_cap}%`, "#0f172a")}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-sm text-slate-600">
        Based on {row.km_per_day} km/day
        {row.driving_source === "trips"
          ? " (from its trips)"
          : row.driving_source === "assumed"
            ? " (typical, no trip data saved)"
            : ""}
        , {row.days_per_week} driving days a week and {row.wh_per_km} Wh/km, on a{" "}
        {row.battery_kwh} kWh LFP pack (
        {row.battery_kwh >= 30 ? "car" : "3-wheeler"} preset).
        {row.top_ups_per_day > 0 &&
          ` At ${row.suggested_cap}% it needs ${row.top_ups_per_day} top-up a day on an average day, which eats into the saving.`}
      </p>
    </div>
  );
}
