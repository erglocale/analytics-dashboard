"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type NudgeHistoryRow, type Preview } from "@/lib/api";
import { useGroup } from "@/lib/group-context";
import { SliderField, type FieldDef } from "@/components/slider-field";
import { PredictionTab } from "@/components/prediction-tab";

type Num = Record<string, number>;

const TABS = [
  { id: "nudges", label: "Nudges" },
  { id: "prediction", label: "Prediction" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const FIELDS: FieldDef[] = [
  { key: "rt_low_soc_pct", label: "Urgent below (SOC %)", help: "At the hub under this → always nudge", min: 10, max: 60, step: 5, unit: "%" },
  { key: "rt_room_pct", label: "Min room below cap (%)", help: "Opportunistic only if SOC is this far under the cap", min: 5, max: 100, step: 5, unit: "%" },
  { key: "rt_min_stay_min", label: "Min predicted stay (min)", help: "Only nudge if even the busy-day estimate says the vehicle stays this long", min: 15, max: 180, step: 15, unit: "m" },
  { key: "rt_radius_km", label: "Hub radius (km)", help: "How far from a hub still counts", min: 0.5, max: 20, step: 0.5, unit: " km" },
  { key: "rt_at_hub_km", label: "At-hub distance (km)", help: "Physically at the hub", min: 0.1, max: 2, step: 0.1, unit: " km" },
  { key: "rt_min_move_soc", label: "Min SOC to drive over (%)", help: "Won't suggest driving to a hub below this", min: 5, max: 50, step: 5, unit: "%" },
  { key: "rt_cooldown_min", label: "Cooldown (min)", help: "Don't re-nudge the same vehicle within this window", min: 0, max: 360, step: 15, unit: "m" },
  { key: "rt_recent_move_min", label: "Mid-trip window (min)", help: "Ongoing trip + moved within this = still driving", min: 5, max: 60, step: 5, unit: "m" },
  { key: "rt_settle_min", label: "Settle time (min)", help: "Wait this long before resolving a nudge's outcome", min: 15, max: 240, step: 15, unit: "m" },
];

const STATUS_STYLE: Record<string, { rail: string; badge: string }> = {
  nudge: { rail: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  wait: { rail: "bg-amber-500", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  skip: { rail: "bg-slate-300", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const OUTCOME_STYLE: Record<string, string> = {
  plugged_in: "bg-emerald-50 text-emerald-800 border-emerald-200",
  left: "bg-red-50 text-red-800 border-red-200",
  ignored: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
};

export default function ChargingPage() {
  const { gid, groupName } = useGroup();
  const [tab, setTab] = useState<TabId>("nudges");
  const [values, setValues] = useState<Num | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [history, setHistory] = useState<NudgeHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gid) return;
    setValues(null);
    setPreview(null);
    setError(null);
    api
      .params(gid)
      .then((p) => {
        const v: Num = {};
        for (const f of FIELDS) v[f.key] = Number(p.effective[f.key]);
        setValues(v);
      })
      .catch((e) => setError(String(e)));
    api.nudgeHistory(gid).then(setHistory).catch(() => setHistory([]));
  }, [gid]);

  const onChange = useCallback((key: string, value: number) => {
    setValues((curr) => (curr ? { ...curr, [key]: value } : curr));
  }, []);

  const save = useCallback(async () => {
    if (!gid || !values) return;
    setSaveState("saving");
    try {
      await api.saveParams(gid, values);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }, [gid, values]);

  const runPreview = useCallback(async () => {
    if (!gid) return;
    setPreviewing(true);
    try {
      setPreview(await api.nudgePreview(gid));
    } catch (e) {
      setError(String(e));
    } finally {
      setPreviewing(false);
    }
  }, [gid]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          {groupName || "…"}
        </p>
        <h1 className="text-xl font-semibold">Realtime charging</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tune when the allocator tells an idle vehicle to plug in, then preview the decision it
          would make right now.
        </p>
      </header>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prediction" && gid && <PredictionTab gid={gid} />}

      {tab === "nudges" && error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === "nudges" && (
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* settings */}
        <section className="h-fit rounded-lg border border-slate-200 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Nudge settings
          </h2>
          {values === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-4">
              {FIELDS.map((f) => (
                <SliderField key={f.key} def={f} value={values[f.key]} onChange={onChange} />
              ))}
              <button
                onClick={save}
                disabled={saveState === "saving"}
                className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : saveState === "error"
                      ? "Save failed — retry"
                      : "Save settings"}
              </button>
              <p className="text-xs text-slate-400">
                Saved settings apply to the scheduled runner too, not just this preview.
              </p>
            </div>
          )}
        </section>

        {/* preview + history */}
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Live decision preview
              </h2>
              <button
                onClick={runPreview}
                disabled={previewing || !gid}
                className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-60"
              >
                {previewing ? "Evaluating fleet…" : "Run preview"}
              </button>
            </div>

            {!preview && !previewing && (
              <p className="text-sm text-slate-500">
                Runs the allocator read-only against live telemetry — nothing is logged or sent.
              </p>
            )}

            {preview && (
              <>
                <div className="mb-4 flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Ports free:</span>{" "}
                    {Object.entries(preview.free_ports).map(([hub, n]) => (
                      <span key={hub} className="font-mono">
                        {hub.split(",")[0]} <b>{n}</b>
                        {"  "}
                      </span>
                    ))}
                  </div>
                  <div className="text-slate-500">
                    source: <span className="font-mono">{preview.source}</span>
                  </div>
                </div>

                <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
                  {[...preview.evaluations]
                    .sort((a, b) => {
                      const order = { nudge: 0, wait: 1, skip: 2 };
                      return order[a.status] - order[b.status] || a.label.localeCompare(b.label);
                    })
                    .map((ev) => {
                      const s = STATUS_STYLE[ev.status];
                      return (
                        <li key={ev.ev_id} className="flex items-stretch bg-white">
                          <span className={`w-1 shrink-0 ${s.rail}`} />
                          <div className="flex flex-1 items-center justify-between gap-3 px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className="w-28 font-mono text-sm font-medium">{ev.label}</span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs ${s.badge}`}
                              >
                                {ev.status}
                              </span>
                            </div>
                            <span className="text-right text-sm text-slate-600">
                              {ev.reason}
                              {ev.slack_min !== undefined && (
                                <span className="ml-2 font-mono text-xs text-slate-400">
                                  slack {ev.slack_min}m
                                </span>
                              )}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Sent nudges — last 7 days
            </h2>
            {history === null && <p className="text-sm text-slate-500">Loading…</p>}
            {history !== null && history.length === 0 && (
              <p className="text-sm text-slate-500">No nudges logged in this window.</p>
            )}
            {history !== null && history.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-medium">When (IST)</th>
                    <th className="py-2 pr-4 font-medium">Vehicle</th>
                    <th className="py-2 pr-4 text-right font-medium">SOC</th>
                    <th className="py-2 pr-4 font-medium">Trigger</th>
                    <th className="py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((n) => {
                    const outcome = n.outcome ?? "pending";
                    return (
                      <tr key={n.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                          {new Date(n.created_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 pr-4 font-mono">{n.label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{n.soc}%</td>
                        <td className="py-2 pr-4 text-slate-600">{n.reason}</td>
                        <td className="py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${OUTCOME_STYLE[outcome]}`}
                          >
                            {outcome === "plugged_in" && n.soc_gain != null
                              ? `plugged in · +${n.soc_gain}%`
                              : outcome.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
      )}
    </div>
  );
}
