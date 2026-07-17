"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DeparturePayload } from "@/lib/api";

const LINE = "#f97417"; // brand — the busy-day stay estimate the allocator uses

type Pt = { t: string; stay: number | null };

// The chart shows the one number the allocator actually decides with: the
// busy-day (p25) stay estimate. Legacy 24-slot rows only have the hourly
// median, served until the next recompute replaces them.
function toSeries(dep: DeparturePayload): Pt[] | null {
  if (!dep) return null;
  if (Array.isArray(dep)) {
    if (dep.length !== 24) return null;
    return dep.map((v, h) => ({ t: `${String(h).padStart(2, "0")}:00`, stay: v }));
  }
  if (dep.v === 2 && dep.p50?.length === 48) {
    const src = dep.p25?.length === 48 ? dep.p25 : dep.p50;
    return src.map((v, i) => ({
      t: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      stay: v,
    }));
  }
  return null;
}

const fmtMin = (v: number) => {
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.round((v / 60) * 10) / 10;
  return `${h} hr`;
};

export default function ProfileChart({ payload }: { payload: DeparturePayload }) {
  const data = toSeries(payload);
  if (!data)
    return <p className="text-sm text-slate-500">No profile stored for this vehicle.</p>;

  const nine = data.find((d) => d.t === "09:00");
  const example =
    nine && nine.stay !== null
      ? nine.stay > 0
        ? `Example: at 9:00 AM this vehicle can be counted on to stay parked for about ${fmtMin(nine.stay)} before its next trip.`
        : `Example: at 9:00 AM this vehicle is usually out on the road, so there is no parked time to count on.`
      : null;

  return (
    <div>
      <div className="mb-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-700">How to read this:</span> for each time of
          day, how much parked time you can count on before the vehicle&rsquo;s next trip —
          measured on its own busier days (1 day in 4 it has less). Higher = more time available
          to charge. Zero means it&rsquo;s usually <em>on the road</em> at that time of day.
        </p>
        {example && <p className="mt-1.5">{example}</p>}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="t"
            interval={5}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [
              typeof v === "number" ? (v > 0 ? fmtMin(v) : "usually on the road") : "—",
              "parked time you can count on",
            ]}
            labelFormatter={(l) => `At ${l} IST`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          />
          <Area
            type="monotone"
            dataKey="stay"
            stroke={LINE}
            strokeWidth={2}
            fill={LINE}
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-500">
        The allocator uses exactly this estimate: a charging nudge is only sent when the value at
        the current time clears the &ldquo;Min predicted stay&rdquo; setting, and it also sets
        charger priority (less predicted time = more urgent).
      </p>
    </div>
  );
}
