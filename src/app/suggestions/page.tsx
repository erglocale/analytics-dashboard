"use client";

import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, type CapRow } from "@/lib/api";
import { useGroup } from "@/lib/group-context";
import { CapSettings } from "@/components/cap-settings";

// Recharts is the heaviest dependency on this route and only needed once a row
// is expanded — load it on demand instead of with the page.
const SweepChart = dynamic(() => import("@/components/sweep-chart"), {
  loading: () => <p className="text-sm text-slate-400">Loading chart…</p>,
  ssr: false,
});

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-50 text-amber-800 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

const TABS = [
  { id: "caps", label: "Suggestions" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CapsTable({ gid }: { gid: string }) {
  const [stored, setStored] = useState<CapRow[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CapRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<
    "idle" | "publishing" | "published" | "error"
  >("idle");

  const loadStored = useCallback(() => {
    api.socCaps(gid).then(setStored).catch((e) => setError(String(e)));
  }, [gid]);

  useEffect(() => {
    setStored(null);
    setError(null);
    setPreview(null);
    setRunning(false);
    setJobError(null);
    setPublishState("idle");
    setOpen(null);
    loadStored();
    // pick up a compute that's still running (or finished) from an earlier visit
    api
      .capRecomputeStatus(gid)
      .then((s) => {
        if (s.status === "running") setRunning(true);
        else if (s.status === "done" && s.caps?.length) setPreview(s.caps);
      })
      .catch(() => {});
  }, [gid, loadStored]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const s = await api.capRecomputeStatus(gid);
        if (s.status === "done") {
          setPreview(s.caps ?? []);
          setRunning(false);
        } else if (s.status === "error") {
          setJobError(s.error ?? "compute failed");
          setRunning(false);
        }
      } catch (e) {
        setJobError(String(e));
        setRunning(false);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [running, gid]);

  const compute = useCallback(async () => {
    setJobError(null);
    setPublishState("idle");
    try {
      await api.startCapRecompute(gid);
      setRunning(true);
    } catch (e) {
      setJobError(String(e));
    }
  }, [gid]);

  const publish = useCallback(async () => {
    setPublishState("publishing");
    try {
      await api.publishCaps(gid);
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
          {computedAt ? (
            <>
              {preview ? "Freshly computed" : "Last computed"}{" "}
              <span className="font-mono text-slate-700">
                {new Date(computedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>{" "}
              IST.
            </>
          ) : (
            " "
          )}
        </p>
        <button
          onClick={compute}
          disabled={running || publishState === "publishing"}
          className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-60"
        >
          {running ? "Running simulation… (takes a few minutes)" : "Compute new suggestions"}
        </button>
      </div>

      {jobError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Compute failed: {jobError}
        </div>
      )}

      {publishState === "published" && !preview && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Sent to the backend — these suggestions are what the ergOS app now serves.
        </div>
      )}

      {preview && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Preview only — this run is <span className="font-semibold">not saved yet</span>.
            Send it to the backend to make it live.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPreview(null);
                setPublishState("idle");
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
          Couldn&apos;t load suggestions: {error}
        </div>
      )}
      {!error && rows === null && <p className="text-sm text-slate-500">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
          No suggestions stored for this group yet — use{" "}
          <span className="font-medium text-slate-700">Compute new suggestions</span> above to run
          the simulation.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Vehicle</th>
                <th className="px-4 py-2.5 text-right font-medium">Suggested cap</th>
                <th className="px-4 py-2.5 text-right font-medium">Lowest safe</th>
                <th className="px-4 py-2.5 text-right font-medium">Days driven</th>
                <th className="px-4 py-2.5 font-medium">Confidence</th>
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
                    <td className="px-4 py-2.5 text-right font-mono text-base font-semibold text-brand-dark">
                      {r.suggested_cap}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      {r.lowest_safe_cap}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                      {r.operating_days}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs ${CONFIDENCE_STYLE[r.confidence]}`}
                      >
                        {r.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                      {open === r.ev_id ? "hide evidence" : "show evidence"}
                    </td>
                  </tr>
                  {open === r.ev_id && (
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td colSpan={6} className="px-6 py-4">
                        <SweepChart row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function SuggestionsPage() {
  const { gid, groupName } = useGroup();
  const [tab, setTab] = useState<TabId>("caps");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          {groupName || "…"}
        </p>
        <h1 className="text-xl font-semibold">SOC cap suggestions</h1>
        <p className="mt-1 text-sm text-slate-500">
          The lowest smart-charge limit that keeps each vehicle safe, backtested against its own
          trip history.
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

      {gid && (tab === "caps" ? <CapsTable gid={gid} /> : <CapSettings gid={gid} />)}
    </div>
  );
}
