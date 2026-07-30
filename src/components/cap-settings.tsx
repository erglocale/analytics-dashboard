"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SliderField, type FieldDef } from "@/components/slider-field";

type Num = Record<string, number>;

// `tolerance_pct` is presentation-only: stored as service_level = 1 − tol/100.
const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Safety",
    fields: [
      { key: "soc_floor_pct", label: "SOC floor (%)", help: "Below this counts as an unsafe day", min: 5, max: 40, step: 5, unit: "%", fallback: 15 },
      { key: "tolerance_pct", label: "Tolerance (unsafe days %)", help: "5% = P95: a top-up on at most ~1 driving day in 20", min: 1, max: 15, step: 1, unit: "%", fallback: 5 },
      { key: "cap_buffer_pct", label: "Cap buffer (%)", help: "Headroom added on top of the lowest safe cap", min: 0, max: 15, step: 5, unit: "%", fallback: 5 },
      { key: "reach_reserve_soc_pct", label: "Reach reserve (SOC %)", help: "Battery the vehicle must still have on arriving at a charger", min: 0, max: 50, step: 1, unit: "%", fallback: 5 },
    ],
  },
  {
    title: "Cap search",
    fields: [
      { key: "cap_step_pct", label: "Sweep step (%)", help: "Caps are tested every this many % (5 → 100, 95, 90…)", min: 1, max: 10, step: 1, unit: "%", fallback: 5 },
      { key: "cap_min_pct", label: "Lowest cap tested (%)", help: "The sweep stops here — it never suggests a cap below this", min: 60, max: 95, step: 5, unit: "%", fallback: 60 },
      { key: "window_days", label: "History window (days)", help: "How many days of history the backtest replays", min: 30, max: 365, step: 15, unit: "d", fallback: 90 },
    ],
  },
  {
    title: "Charging behaviour",
    fields: [
      { key: "fast_kw_boundary", label: "Fast-charger threshold (kW)", help: "Chargers at or above this power count as fast", min: 5, max: 50, step: 1, unit: " kW", fallback: 22 },
      { key: "min_slow_min", label: "Min slow-charge window (min)", help: "Idle gaps shorter than this are not used", min: 30, max: 240, step: 15, unit: "m", fallback: 90 },
      { key: "fast_boost_kw", label: "Fast top-up rate (kW)", help: "Power assumed for the emergency fast charge", min: 0, max: 100, step: 5, unit: " kW", fallback: 30 },
      { key: "fast_min_min", label: "Fast top-up duration (min)", help: "Minimum minutes for a fast top-up", min: 10, max: 60, step: 5, unit: "m", fallback: 20 },
      { key: "fast_target_soc_pct", label: "Fast top-up target (SOC %)", help: "Fast charge stops at this level", min: 0, max: 100, step: 5, unit: "%", fallback: 80 },
    ],
  },
  {
    title: "Reachability",
    fields: [
      { key: "slow_radius_km", label: "Daytime hub radius (km)", help: "How far a vehicle will go for a daytime slow charge", min: 1, max: 20, step: 1, unit: " km", fallback: 5 },
      { key: "overnight_radius_km", label: "Overnight radius (km)", help: "How far for the overnight charge", min: 5, max: 60, step: 5, unit: " km", fallback: 30 },
      { key: "overnight_min_hours", label: "Overnight min hours", help: "A gap must be at least this long to count as overnight", min: 2, max: 12, step: 1, unit: "h", fallback: 6 },
      { key: "avg_speed_kmh", label: "Average speed (km/h)", help: "Used to convert distance into travel time", min: 10, max: 60, step: 5, unit: " km/h", fallback: 25 },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

export function CapSettings({ gid }: { gid: string }) {
  const [values, setValues] = useState<Num | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [allWindow, setAllWindow] = useState<{ from: string; to: string } | null>(null);
  const allHistory = values !== null && values.window_days === 0;

  // Only fetched when "all history" is on, to show the real dates it covers.
  useEffect(() => {
    if (!allHistory) return;
    let cancelled = false;
    api
      .dataWindow(gid)
      .then((w) => {
        if (!cancelled) setAllWindow(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gid, allHistory]);

  useEffect(() => {
    setValues(null);
    setError(null);
    setAllWindow(null);
    api
      .params(gid)
      .then((p) => {
        const v: Num = {};
        for (const f of ALL_FIELDS) {
          const n =
            f.key === "tolerance_pct"
              ? Math.round((1 - Number(p.effective.service_level)) * 100)
              : Number(p.effective[f.key]);
          v[f.key] = Number.isFinite(n) ? n : f.fallback;
        }
        setValues(v);
      })
      .catch((e) => setError(String(e)));
  }, [gid]);

  const onChange = useCallback((key: string, value: number) => {
    setValues((curr) => (curr ? { ...curr, [key]: value } : curr));
  }, []);

  const save = useCallback(async () => {
    if (!values) return;
    setSaveState("saving");
    try {
      const { tolerance_pct, ...rest } = values;
      await api.saveParams(gid, {
        ...rest,
        service_level: 1 - tolerance_pct / 100,
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }, [gid, values]);

  if (error)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Couldn&apos;t load settings: {error}
      </div>
    );
  if (values === null) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.fields.map((f) =>
                // window_days doubles as an "all history" switch: 0 = no limit,
                // start from the fleet's first day of data.
                f.key === "window_days" ? (
                  <div key={f.key} className="space-y-2">
                    {values[f.key] !== 0 && (
                      <SliderField def={f} value={values[f.key]} onChange={onChange} />
                    )}
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={values[f.key] === 0}
                        onChange={(e) => onChange(f.key, e.target.checked ? 0 : f.fallback)}
                      />
                      Use all available history
                    </label>
                    {values[f.key] === 0 && (
                      <p className="text-xs text-slate-400">
                        {allWindow
                          ? `Replays ${allWindow.from} → ${allWindow.to} — everything since the fleet's telematics devices were installed.`
                          : "The backtest replays everything from the fleet's first day of data (after its telematics devices were installed)."}
                      </p>
                    )}
                  </div>
                ) : (
                  <SliderField key={f.key} def={f} value={values[f.key]} onChange={onChange} />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saveState === "saving"}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed — retry"
                : "Save cap settings"}
        </button>
        <p className="text-xs text-slate-400">
          Suggestions are recomputed on the next scheduled run using these settings.
        </p>
      </div>
    </div>
  );
}
