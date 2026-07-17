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
      { key: "soc_floor_pct", label: "SOC floor (%)", help: "Below this counts as an unsafe day", min: 5, max: 40, step: 5, unit: "%" },
      { key: "tolerance_pct", label: "Tolerance (unsafe days %)", help: "5% = P95: a top-up on at most ~1 driving day in 20", min: 1, max: 15, step: 1, unit: "%" },
      { key: "cap_buffer_pct", label: "Cap buffer (%)", help: "Headroom added on top of the lowest safe cap", min: 0, max: 15, step: 5, unit: "%" },
      { key: "reach_safety_buffer_km", label: "Reach reserve (km)", help: "Range kept aside when checking charger reach", min: 0, max: 15, step: 1, unit: " km" },
    ],
  },
  {
    title: "Charging behaviour",
    fields: [
      { key: "min_slow_min", label: "Min slow-charge window (min)", help: "Idle gaps shorter than this are not used", min: 30, max: 240, step: 15, unit: "m" },
      { key: "fast_boost_kw", label: "Fast top-up rate (kW)", help: "Power assumed for the emergency fast charge", min: 10, max: 100, step: 5, unit: " kW" },
      { key: "fast_min_min", label: "Fast top-up duration (min)", help: "Minimum minutes for a fast top-up", min: 10, max: 60, step: 5, unit: "m" },
      { key: "fast_target_soc_pct", label: "Fast top-up target (SOC %)", help: "Fast charge stops at this level", min: 30, max: 80, step: 5, unit: "%" },
    ],
  },
  {
    title: "Reachability",
    fields: [
      { key: "slow_radius_km", label: "Daytime hub radius (km)", help: "How far a vehicle will go for a daytime slow charge", min: 1, max: 20, step: 1, unit: " km" },
      { key: "overnight_radius_km", label: "Overnight radius (km)", help: "How far for the overnight charge", min: 5, max: 60, step: 5, unit: " km" },
      { key: "overnight_min_hours", label: "Overnight min hours", help: "A gap must be at least this long to count as overnight", min: 2, max: 12, step: 1, unit: "h" },
      { key: "avg_speed_kmh", label: "Average speed (km/h)", help: "Used to convert distance into travel time", min: 10, max: 60, step: 5, unit: " km/h" },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

export function CapSettings({ gid }: { gid: string }) {
  const [values, setValues] = useState<Num | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(null);
    setError(null);
    api
      .params(gid)
      .then((p) => {
        const v: Num = {};
        for (const f of ALL_FIELDS) {
          if (f.key === "tolerance_pct") {
            v[f.key] = Math.round((1 - Number(p.effective.service_level)) * 100);
          } else {
            v[f.key] = Number(p.effective[f.key]);
          }
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
    <div className="max-w-3xl">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.fields.map((f) => (
                <SliderField key={f.key} def={f} value={values[f.key]} onChange={onChange} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4">
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
