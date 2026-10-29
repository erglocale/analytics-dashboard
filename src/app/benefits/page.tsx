"use client";

import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, type BenefitRow } from "@/lib/api";
import { useGroup } from "@/lib/group-context";

const BenefitChart = dynamic(() => import("@/components/benefit-chart"), {
  loading: () => <p className="text-sm text-slate-400">Loading chart…</p>,
  ssr: false,
});

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** null = beyond the 40-year horizon */
const years = (y: number | null) => (y == null ? "40+" : fmt(y, 1));

function extraYears(r: BenefitRow): number | null {
  if (r.years_to_80_full == null) return null;
  return (r.years_to_80_cap ?? 40) - r.years_to_80_full;
}

/** Extra km on a full charge after 8 years: capacity kept × usable kWh ÷ Wh/km
 * (usable share as the presets: 3-wheeler 95 %, car 96.5 % of the pack) */
function rangeGainKm(r: BenefitRow): number {
  const usable = r.battery_kwh * (r.battery_kwh >= 30 ? 0.965 : 0.95);
  return ((r.capacity_8y_cap_pct - r.capacity_8y_full_pct) / 100) * usable * 1000 / r.wh_per_km;
}

/** Extra range as a share of the 8-year range when always charging to 100 % */
function rangeGainPct(r: BenefitRow): number {
  return ((r.capacity_8y_cap_pct - r.capacity_8y_full_pct) / r.capacity_8y_full_pct) * 100;
}

/** "+4% more capacity", or null ("no change") when the cap gains nothing */
function gainText(diff: number, unit: string, digits = 0): string | null {
  const shown = Number(diff.toFixed(digits));
  return shown > 0 ? `+${fmt(shown, digits)}${unit}` : null;
}

function Gain({ text }: { text: string | null }) {
  return (
    <span
      className={`mt-0.5 block whitespace-nowrap font-sans text-xs ${text ? "text-emerald-700" : "text-slate-400"}`}
    >
      {text ?? "no change"}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function FleetSummary({ rows }: { rows: BenefitRow[] }) {
  const saved = rows.reduce((s, r) => s + r.kwh_saved_per_year, 0);
  const extras = rows.map(extraYears).filter((y): y is number => y != null);
  const avgExtra = extras.length ? extras.reduce((s, y) => s + y, 0) / extras.length : 0;
  const avg = (k: "capacity_8y_full_pct" | "capacity_8y_cap_pct") =>
    rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat
        label="Energy saved per year"
        value={`${fmt(saved)} kWh`}
        hint={`across ${rows.length} vehicle${rows.length === 1 ? "" : "s"}`}
      />
      <Stat
        label="Extra battery life"
        value={`+${fmt(avgExtra, 1)} years`}
        hint="average, before the battery reaches 80%"
      />
      <Stat
        label="Battery left after 8 years"
        value={`${fmt(avg("capacity_8y_full_pct"), 1)}% → ${fmt(avg("capacity_8y_cap_pct"), 1)}%`}
        hint="fleet average, 100% vs suggested cap"
      />
    </div>
  );
}

function BenefitsTable({ gid }: { gid: string }) {
  const [stored, setStored] = useState<BenefitRow[] | null>(null);
  const [preview, setPreview] = useState<BenefitRow[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">(
    "idle",
  );

  const loadStored = useCallback(() => {
    api.benefits(gid).then(setStored).catch((e) => setError(String(e)));
  }, [gid]);

  // The page remounts this per group (key={gid}), so state starts fresh
  useEffect(() => {
    loadStored();
    // pick up a run that's still going (or finished) from an earlier visit
    api
      .benefitRecomputeStatus(gid)
      .then((s) => {
        if (s.status === "running") setRunning(true);
        else if (s.status === "done" && s.rows?.length) {
          setPreview(s.rows);
          setSkipped(s.skipped ?? []);
        }
      })
      .catch(() => {});
  }, [gid, loadStored]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const s = await api.benefitRecomputeStatus(gid);
        if (s.status === "done") {
          setPreview(s.rows ?? []);
          setSkipped(s.skipped ?? []);
          setRunning(false);
        } else if (s.status === "error") {
          setJobError(s.error ?? "compute failed");
          setRunning(false);
        }
      } catch (e) {
        setJobError(String(e));
        setRunning(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [running, gid]);

  const compute = useCallback(async () => {
    setJobError(null);
    setPublishState("idle");
    try {
      await api.startBenefitRecompute(gid);
      setRunning(true);
    } catch (e) {
      setJobError(String(e));
    }
  }, [gid]);

  const publish = useCallback(async () => {
    setPublishState("publishing");
    try {
      await api.publishBenefits(gid);
      setPublishState("published");
      setPreview(null);
      setOpen(null);
      loadStored();
    } catch {
      setPublishState("error");
    }
  }, [gid, loadStored]);

  const rows = preview ?? stored;
  const computedAt = rows?.[0]?.computed_at;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {preview ? (
            "Freshly computed."
          ) : computedAt ? (
            <>
              Last computed{" "}
              <span className="font-mono text-slate-700">
                {new Date(computedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>{" "}
              IST.
            </>
          ) : (
            " "
          )}
        </p>
        <button
          onClick={compute}
          disabled={running || publishState === "publishing"}
          className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-60"
        >
          {running ? "Computing…" : "Compute benefits"}
        </button>
      </div>

      {jobError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Compute failed: {jobError}
        </div>
      )}

      {publishState === "published" && !preview && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Saved — these benefits are now stored for this group.
        </div>
      )}

      {preview && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Preview only — this run is <span className="font-semibold">not saved yet</span>.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPreview(null);
                setSkipped([]);
                setPublishState("idle");
                api.discardBenefits(gid).catch(() => {});
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Discard
            </button>
            <button
              onClick={publish}
              disabled={publishState === "publishing"}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {publishState === "publishing"
                ? "Sending…"
                : publishState === "error"
                  ? "Send failed — retry"
                  : "Send to backend"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Couldn&apos;t load benefits: {error}
        </div>
      )}
      {!error && rows === null && <p className="text-sm text-slate-500">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
          No benefits stored for this group yet. Use{" "}
          <span className="font-medium text-slate-700">Compute benefits</span> above. It uses the
          SOC caps already sent to the backend.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <FleetSummary rows={rows} />
          <p className="mb-2 text-xs text-slate-500">
            Each cell shows <span className="font-mono">100% → cap</span>; the{" "}
            <span className="text-emerald-700">green line</span> is what the cap gains compared
            with charging to 100%. Range is per full charge after 8 years.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Vehicle</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cap</th>
                  <th className="px-4 py-2.5 text-right font-medium">kWh saved / yr</th>
                  <th className="px-4 py-2.5 text-right font-medium">Battery after 8 yrs</th>
                  <th className="px-4 py-2.5 text-right font-medium">Years to 80%</th>
                  <th className="px-4 py-2.5 text-right font-medium">Range after 8 yrs</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.ev_id}>
                    <tr
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      onClick={() => setOpen(open === r.ev_id ? null : r.ev_id)}
                    >
                      <td className="px-4 py-2.5 font-mono font-medium">{r.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-brand-dark">
                        {r.suggested_cap}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {/* Under 0.5 kWh is model noise (standby timing), not a saving */}
                        {Math.abs(r.kwh_saved_per_year) < 0.5 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          fmt(r.kwh_saved_per_year)
                        )}
                        {r.top_ups_per_day > 0 && (
                          <span className="ml-1 text-xs text-amber-700">(top-ups)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                        {fmt(r.capacity_8y_full_pct, 1)}% →{" "}
                        <span className="font-semibold text-slate-900">
                          {fmt(r.capacity_8y_cap_pct, 1)}%
                        </span>
                        <Gain
                          text={gainText(
                            r.capacity_8y_cap_pct - r.capacity_8y_full_pct,
                            "% more capacity",
                            1,
                          )}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                        {years(r.years_to_80_full)} →{" "}
                        <span className="font-semibold text-slate-900">
                          {years(r.years_to_80_cap)}
                        </span>
                        <Gain
                          text={
                            r.years_to_80_cap == null && r.years_to_80_full != null
                              ? `+${fmt(40 - r.years_to_80_full, 1)}+ yrs longer life`
                              : gainText(extraYears(r) ?? 0, " yrs longer life", 1)
                          }
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        <span className="font-semibold text-slate-900">
                          {rangeGainKm(r) >= 0.5
                            ? `+${fmt(rangeGainKm(r), rangeGainKm(r) < 10 ? 1 : 0)} km`
                            : "—"}
                        </span>
                        <Gain
                          text={
                            rangeGainKm(r) >= 0.5
                              ? `+${fmt(rangeGainPct(r), 1)}% more range`
                              : null
                          }
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                        {open === r.ev_id ? "hide chart" : "show chart"}
                      </td>
                    </tr>
                    {open === r.ev_id && (
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <td colSpan={7} className="px-6 py-4">
                          <BenefitChart row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {skipped.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">Not included: {skipped.join(", ")}.</p>
          )}
        </>
      )}
    </>
  );
}

export default function BenefitsPage() {
  const { gid, groupName } = useGroup();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          {groupName || "…"}
        </p>
        <h1 className="text-xl font-semibold">Battery benefit</h1>
        <p className="mt-1 text-sm text-slate-500">
          What each vehicle gains from its suggested SOC cap compared with charging to 100%: grid
          energy saved, longer battery life and range kept. From a battery model of an LFP pack
          (3-wheeler or car, by battery size), using each vehicle&apos;s battery and the driving
          days from its SOC cap run.
        </p>
      </header>
      {gid && <BenefitsTable key={gid} gid={gid} />}
    </div>
  );
}
