"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { api, type ProfileRecompute, type ProfileRow } from "@/lib/api";

// Recharts loads on demand — this tab is the only place on the route using it.
const ProfileChart = dynamic(() => import("@/components/profile-chart"), {
  loading: () => <p className="text-sm text-slate-400">Loading chart…</p>,
  ssr: false,
});

export function PredictionTab({ gid }: { gid: string }) {
  const [stored, setStored] = useState<ProfileRow[] | null>(null);
  const [fresh, setFresh] = useState<ProfileRecompute | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [publishState, setPublishState] = useState<
    "idle" | "publishing" | "published" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const loadStored = useCallback(() => {
    api.profiles(gid).then(setStored).catch((e) => setError(String(e)));
  }, [gid]);

  useEffect(() => {
    setStored(null);
    setFresh(null);
    setSelected(null);
    setPublishState("idle");
    setError(null);
    loadStored();
  }, [gid, loadStored]);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setError(null);
    setPublishState("idle");
    try {
      setFresh(await api.recomputeProfiles(gid));
    } catch (e) {
      setError(String(e));
    } finally {
      setPreparing(false);
    }
  }, [gid]);

  const publish = useCallback(async () => {
    setPublishState("publishing");
    try {
      await api.publishProfiles(gid);
      setPublishState("published");
      setFresh(null);
      loadStored();
    } catch {
      setPublishState("error");
    }
  }, [gid, loadStored]);

  const profiles = fresh ? fresh.profiles : (stored ?? []);
  const current = profiles.find((p) => p.ev_id === selected) ?? profiles[0];
  const storedMeta = stored?.[0];

  return (
    <section className="rounded-lg border border-slate-200 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Free-time prediction by time of day
        </h2>
        <button
          onClick={prepare}
          disabled={preparing}
          className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-60"
        >
          {preparing ? "Computing from latest trips…" : "Prepare fresh prediction"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {publishState === "published" && !fresh && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Profiles updated in the database — the realtime allocator uses them from its next tick.
        </div>
      )}

      {fresh && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Fresh prediction from trips{" "}
            <span className="font-mono">{fresh.window_from}</span> →{" "}
            <span className="font-mono">{fresh.window_to}</span> —{" "}
            <span className="font-semibold">not saved yet</span>.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setFresh(null);
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
                ? "Updating…"
                : publishState === "error"
                  ? "Update failed — retry"
                  : "Send update to DB"}
            </button>
          </div>
        </div>
      )}

      {stored === null && !fresh && <p className="text-sm text-slate-500">Loading…</p>}

      {stored !== null && profiles.length === 0 && (
        <p className="text-sm text-slate-600">
          No profiles for this group yet — use{" "}
          <span className="font-medium text-slate-700">Prepare fresh prediction</span> to compute
          them from the trip history.
        </p>
      )}

      {current && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-500" htmlFor="profile-vehicle">
              Vehicle
            </label>
            <select
              id="profile-vehicle"
              value={current.ev_id}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono focus:border-brand focus:outline-none"
            >
              {profiles.map((p) => (
                <option key={p.ev_id} value={p.ev_id}>
                  {p.label}
                </option>
              ))}
            </select>
            {!fresh && storedMeta && (
              <span className="text-xs text-slate-400">
                Stored profile · trips{" "}
                <span className="font-mono">{storedMeta.window_from?.slice(0, 10)}</span> →{" "}
                <span className="font-mono">{storedMeta.window_to?.slice(0, 10)}</span>
                {storedMeta.computed_at && (
                  <>
                    {" "}
                    · computed{" "}
                    <span className="font-mono">
                      {new Date(storedMeta.computed_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>{" "}
                    IST
                  </>
                )}
              </span>
            )}
          </div>
          <ProfileChart payload={current.departure_min} />
        </>
      )}
    </section>
  );
}
