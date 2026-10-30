"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { api, type BacktestResult } from "@/lib/api";
import { useGroup } from "@/lib/group-context";

const BacktestChart = dynamic(() => import("@/components/backtest-chart"), {
  loading: () => <p className="text-sm text-slate-400">Loading chart…</p>,
  ssr: false,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** "2026-03-01" → "1 Mar 2026"; "2026-03" → "Mar 2026" */
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const month = `${MONTHS[Number(m) - 1]} ${y}`;
  return day ? `${Number(day)} ${month}` : month;
}

function Stat({ n, label, value, hint }: { n: number; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-500">
        <span className="mr-1 font-mono text-slate-400">{n}.</span>
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

/** "2026-01-17T11:28" → "17 Jan 2026, 11:28" */
function fmtDateTime(iso: string) {
  const [d, time] = iso.split("T");
  return `${fmtDate(d)}, ${time.slice(0, 5)}`;
}

const SESSIONS_SHOWN = 20;

/** The real public charges a nudge would have moved, with the nudge behind each */
function MovedSessions({ sessions }: { sessions: BacktestResult["moved_sessions"] }) {
  const [all, setAll] = useState(false);
  if (!sessions.length) return null;
  const shown = all ? sessions : sessions.slice(0, SESSIONS_SHOWN);
  return (
    <>
      <h2 className="mb-2 text-sm font-semibold text-slate-800">
        Public charges our charging suggestions would have moved ({sessions.length})
      </h2>
      <div className="mb-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Vehicle</th>
              <th className="px-4 py-2.5 font-medium">Public charge</th>
              <th className="px-4 py-2.5 text-right font-medium">kWh</th>
              <th className="px-4 py-2.5 text-right font-medium">Moved</th>
              <th className="px-4 py-2.5 font-medium">Suggestion that would have moved it</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={`${s.label}-${s.start}`} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono font-medium">{s.label}</td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-600">
                  {fmtDateTime(s.start)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-600">{fmt(s.public_kwh, 1)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(s.moved_kwh, 1)}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {fmtDateTime(s.nudge_time)} at {s.nudge_hub}: {s.nudge_trigger} (SOC{" "}
                  {fmt(s.nudge_soc)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sessions.length > SESSIONS_SHOWN && (
        <button
          onClick={() => setAll((a) => !a)}
          className="mb-6 text-xs font-medium text-brand-dark hover:underline"
        >
          {all ? "Show fewer" : `Show all ${sessions.length}`}
        </button>
      )}
      {sessions.length <= SESSIONS_SHOWN && <div className="mb-6" />}
    </>
  );
}

type VehicleCaps = BacktestResult["caps"][number];

/** "2026-03" → "Mar 26" */
const monthShort = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** Runs of the same cap: "75% Dec 25–May 26 · 90% Jun 26–Sep 26" */
function capTimeline(c: VehicleCaps): string {
  const runs: { cap: number; from: string; to: string }[] = [];
  c.months.forEach(({ month, cap }) => {
    const last = runs[runs.length - 1];
    if (last && last.cap === cap) last.to = month;
    else runs.push({ cap, from: month, to: month });
  });
  if (runs.length === 1) return `${runs[0].cap}% all period`;
  return runs
    .map((r) => `${r.cap}% ${monthShort(r.from)}${r.to !== r.from ? `–${monthShort(r.to)}` : ""}`)
    .join(" · ");
}

const isCapped = (c: VehicleCaps) => c.months.some((m) => m.cap < 100);

/** How the caps were learned, in one line */
function capRule(r: BacktestResult): string {
  const first = r.cap_windows[0];
  return (
    `Months 1–4 use the SOC cap learned from the first 3 months (${fmtDate(first.from)} – ` +
    `${fmtDate(first.to)}); from month 5, each month gets a new cap learned from the 3 months before it.`
  );
}

function Result({ r }: { r: BacktestResult }) {
  const t = r.totals;
  const capped = r.caps.filter(isCapped);
  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        <span className="font-medium text-slate-800">
          {fmtDate(r.period_from)} – {fmtDate(r.period_to)}
        </span>{" "}
        ({r.months} full months). {capRule(r)}
      </p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          n={1}
          label="kWh saved from the SOC cap"
          value={`${fmt(t.kwh_saved)} kWh`}
          hint={`vs charging to 100%, ${capped.length} capped vehicle${capped.length === 1 ? "" : "s"}`}
        />
        <Stat
          n={2}
          label="km unlocked from the SOC cap"
          value={`+${fmt(t.km_per_full_charge, 1)} km`}
          hint={`more range per full charge across the fleet, from battery kept by ${fmtDate(r.period_to)}`}
        />
        <Stat
          n={3}
          label="kWh moved from public to private"
          value={`${fmt(t.kwh_moved)} kWh`}
          hint={`${t.moved_sessions} of ${t.public_sessions} public charges could have been at the hub (public ${fmt(t.public_kwh)} → ${fmt(t.public_after_kwh)} kWh)`}
        />
        <Stat
          n={4}
          label="Total extra km from the SOC cap"
          value={`+${fmt(t.total_extra_km)} km`}
          hint={`extra range the whole fleet had available over ${r.months} months, from batteries wearing out more slowly`}
        />
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 p-4">
        <BacktestChart monthly={r.monthly} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Month by month (kWh)</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Month</th>
              <th className="px-4 py-2.5 text-right font-medium">Saved by SOC cap</th>
              <th className="px-4 py-2.5 text-right font-medium">Public, actual</th>
              <th className="px-4 py-2.5 text-right font-medium">Moved to hub</th>
              <th className="px-4 py-2.5 text-right font-medium">Public left</th>
            </tr>
          </thead>
          <tbody>
            {r.monthly.map((m) => (
              <tr key={m.month} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-mono">{fmtDate(m.month)}</td>
                <td className="px-4 py-2 text-right font-mono">{fmt(m.kwh_saved, 1)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-600">{fmt(m.public_kwh)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(m.kwh_moved)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-600">{fmt(m.public_after_kwh)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right font-mono">{fmt(t.kwh_saved, 1)}</td>
              <td className="px-4 py-2 text-right font-mono">{fmt(t.public_kwh)}</td>
              <td className="px-4 py-2 text-right font-mono">{fmt(t.kwh_moved)}</td>
              <td className="px-4 py-2 text-right font-mono">{fmt(t.public_after_kwh)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Per vehicle</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Vehicle</th>
              <th className="px-4 py-2.5 font-medium">SOC cap by month</th>
              <th className="px-4 py-2.5 text-right font-medium">Battery left at period end</th>
              <th className="px-4 py-2.5 text-right font-medium">km unlocked</th>
              <th className="px-4 py-2.5 text-right font-medium">Total extra km</th>
            </tr>
          </thead>
          <tbody>
            {r.caps.map((c) => {
              const k = r.km.find((x) => x.ev_id === c.ev_id);
              return (
                <tr key={c.ev_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-mono font-medium">{c.label}</td>
                  <td className="px-4 py-2 text-xs text-brand-dark">{capTimeline(c)}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">
                    {k ? `${fmt(k.capacity_full_pct, 1)}% → ${fmt(k.capacity_cap_pct, 1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {k ? `+${fmt(k.km_per_full_charge, 1)} km` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {k ? `+${fmt(k.total_extra_km)} km` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MovedSessions sessions={r.moved_sessions} />

      {r.not_simulated.length > 0 && (
        <p className="mb-4 text-xs text-slate-500">Not included: {r.not_simulated.join(", ")}.</p>
      )}

    </>
  );
}

function Step({
  n,
  title,
  fleet,
  children,
}: {
  n: number;
  title: string;
  fleet?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-dark">
          {n}
        </span>
        {title}
      </h2>
      <ul className="ml-8 list-disc space-y-1.5 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
        {children}
      </ul>
      {fleet && (
        <div className="ml-8 mt-3 rounded-md border-l-4 border-brand bg-brand-soft px-3 py-2 text-sm text-slate-800">
          {fleet}
        </div>
      )}
    </section>
  );
}

/** Most frequent value in a list */
function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: string | null = null;
  counts.forEach((c, v) => {
    if (best === null || c > (counts.get(best) ?? 0)) best = v;
  });
  return best;
}

/** Each step's real numbers for the selected fleet, from its latest backtest run */
function fleetNumbers(r: BacktestResult, name: string) {
  const t = r.totals;
  const capped = r.caps.filter(isCapped);
  const best = [...r.km].sort((a, b) => b.km_per_full_charge - a.km_per_full_charge)[0];
  const bestCaps = best ? r.caps.find((c) => c.ev_id === best.ev_id) : undefined;
  const mostKm = [...r.km].sort((a, b) => b.total_extra_km - a.total_extra_km)[0];
  const example = r.moved_sessions[0];
  const hub = mostCommon(r.moved_sessions.map((s) => s.nudge_hub));
  const label = <b>For {name}:</b>;

  return {
    period: (
      <>
        {label} data starts on {fmtDate(r.data_from)}, so the period is{" "}
        <b>
          {fmtDate(r.period_from)} – {fmtDate(r.period_to)}
        </b>{" "}
        ({r.months} full months).
      </>
    ),
    caps: (
      <>
        {label} {capRule(r)}{" "}
        {capped.length ? (
          <>
            <b>
              {capped.length} of {r.caps.length} vehicles
            </b>{" "}
            get a cap below 100% in at least one month. For example, {capped[0].label}:{" "}
            {capTimeline(capped[0])}.
          </>
        ) : (
          <>Every vehicle comes out at 100% every month, so none are capped.</>
        )}
      </>
    ),
    saved: (
      <>
        {label} <b>{fmt(t.kwh_saved)} kWh</b> saved over {r.months} months
        {capped.length > 0 && (
          <>
            , about {fmt(t.kwh_saved / r.months / capped.length, 1)} kWh per capped vehicle per
            month
          </>
        )}
        .
      </>
    ),
    km: best ? (
      <>
        {label} {best.label} would have <b>{fmt(best.capacity_full_pct, 1)}%</b> battery left
        charging to 100%, but <b>{fmt(best.capacity_cap_pct, 1)}%</b> with its caps (
        {bestCaps ? capTimeline(bestCaps) : "—"}). That
        is <b>+{fmt(best.km_per_full_charge, 1)} km</b> on every full charge. Across the fleet:{" "}
        <b>+{fmt(t.km_per_full_charge, 1)} km</b>.
      </>
    ) : (
      <>{label} no vehicle is capped, so no km are unlocked.</>
    ),
    totalKm: mostKm ? (
      <>
        {label} <b>+{fmt(t.total_extra_km)} km</b> of extra range over {r.months} months across
        the fleet. The most was {mostKm.label}: <b>+{fmt(mostKm.total_extra_km)} km</b>.
      </>
    ) : (
      <>{label} no vehicle is capped, so there&apos;s no extra range.</>
    ),
    moved: example ? (
      <>
        {label} <b>{fmt(t.kwh_moved)} kWh</b> of {fmt(t.public_kwh)} kWh public charging could
        have moved, from <b>
          {t.moved_sessions} of {t.public_sessions}
        </b>{" "}
        public charges{hub && <>, mostly at {hub}</>}. Example: {example.label} was parked near{" "}
        {example.nudge_hub} on {fmtDateTime(example.nudge_time)} at {fmt(example.nudge_soc)}%
        battery ({example.nudge_trigger}), so its public charge on {fmtDateTime(example.start)}{" "}
        needed {fmt(example.moved_kwh, 1)} kWh less.
      </>
    ) : (
      <>
        {label} none of its {t.public_sessions} public charges ({fmt(t.public_kwh)} kWh) would have
        moved: a suggestion wouldn&apos;t have fired before any of them.
      </>
    ),
  };
}

function HowItWorks({ gid, name }: { gid: string | null; name: string }) {
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    if (!gid) return;
    api
      .backtestStatus(gid)
      .then((s) => setResult(s.status === "done" && s.result ? s.result : null))
      .catch(() => setResult(null));
  }, [gid]);

  const f = result ? fleetNumbers(result, name || "this fleet") : null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">What is this page?</p>
        <ul className="ml-5 mt-1 list-disc space-y-1">
          <li>
            It answers one question: &ldquo;What if this fleet had followed our tips from day
            one?&rdquo;
          </li>
          <li>
            Tip 1, the <b>SOC cap</b>: don&apos;t charge the battery all the way to 100%. Stop
            earlier, for example at 80%. (SOC means how full the battery is.)
          </li>
          <li>
            Tip 2, the <b>charging suggestions</b>: charge at your own hub when you&apos;re nearby,
            instead of paying at a public charger later.
          </li>
          <li>
            We replay the fleet&apos;s real trips with these tips switched on, and compare with
            what really happened.
          </li>
          <li>kWh is the unit of electricity, like litres for petrol.</li>
        </ul>
        {!f && (
          <p className="mt-2 text-xs text-slate-500">
            Run the backtest on the Results tab to see this fleet&apos;s own numbers under each step.
          </p>
        )}
      </div>

      <Step n={1} title="Pick the months to look at" fleet={f?.period}>
        <li>We use all the trip data we have for the fleet.</li>
        <li>We only count full months, from the 1st to the last day.</li>
        <li>If the data starts in the middle of a month, we skip that month.</li>
        <li>We also skip this month, because it isn&apos;t over yet.</li>
      </Step>

      <Step n={2} title="Find each vehicle's best charge limit (SOC cap)" fleet={f?.caps}>
        <li>We take 3 months of the vehicle&apos;s real trips.</li>
        <li>We pretend it charged to 100%, then a bit less, then a bit less again.</li>
        <li>
          Each time, we count the <b>bad days</b>: days the battery ran too low, or it needed a
          quick emergency charge.
        </li>
        <li>
          We keep going lower while the limit adds at most 1 extra bad day in every 20 days.
        </li>
        <li>Then we add 5% extra, just to be safe. That&apos;s the vehicle&apos;s SOC cap.</li>
        <li>The first 4 months use the cap from the first 3 months.</li>
        <li>
          After that, every month gets a new cap from the 3 months just before it. So the cap
          changes when the vehicle drives more or less.
        </li>
        <li>If the answer is 100%, that vehicle is simply not capped.</li>
      </Step>

      <Step n={3} title="Box 1: electricity saved (kWh)" fleet={f?.saved}>
        <li>A battery charged to 100% doesn&apos;t stop right away when it&apos;s full.</li>
        <li>
          It keeps the charger on for about 30–40 more minutes to balance itself. That electricity
          is wasted.
        </li>
        <li>A vehicle that stops at its cap, say 80%, never gets there, so it doesn&apos;t waste it.</li>
        <li>
          For each vehicle and each month, we use a battery calculator twice: once charging to
          100%, once charging to the cap.
        </li>
        <li>The difference is the electricity saved. We add up all months and all vehicles.</li>
      </Step>

      <Step n={4} title="Box 2: extra range on a full charge (km)" fleet={f?.km}>
        <li>Batteries get weaker over time, like a phone battery.</li>
        <li>They get weaker faster when they sit at 100% for a long time.</li>
        <li>A lower charge limit means the battery wears out more slowly.</li>
        <li>
          We work out how strong each battery would be at the end: charging to 100% vs charging to
          the cap.
        </li>
        <li>
          The stronger battery holds a bit more energy, so the vehicle can go a few km further on
          a full charge.
        </li>
        <li>We add up these extra km for all vehicles.</li>
      </Step>

      <Step n={5} title="Box 3: charging moved from public chargers to your hub" fleet={f?.moved}>
        <li>
          First we look at real charging: was each charge at the fleet&apos;s own hub, or at a
          public charger?
        </li>
        <li>Then, for every time a vehicle was parked, we ask: &ldquo;Would we have sent a tip to charge now?&rdquo;</li>
        <li>We send a tip only when:</li>
        <ul className="ml-5 list-[circle] space-y-1">
          <li>the vehicle is within 5 km of its hub, and</li>
          <li>
            its battery is very low (under 35%) at the hub, or it has room to charge and will stay
            parked a while, and
          </li>
          <li>a charger at the hub is free.</li>
        </ul>
        <li>If the tip would have been sent, the vehicle charges at the hub.</li>
        <li>So its next public charge needs less electricity. That part is &ldquo;moved&rdquo; to the hub.</li>
        <li>We add this up for every public charge.</li>
      </Step>

      <Step n={6} title="Box 4: total extra km for the whole fleet" fleet={f?.totalKm}>
        <li>Box 2 shows the extra km on one full charge, at the end.</li>
        <li>But the battery saving builds up slowly, a little every day.</li>
        <li>So each day the vehicle drove, it had a few extra km to spare.</li>
        <li>We add up those extra km for every day and every vehicle.</li>
        <li>
          This is extra range that was there if needed. The vehicles still drove the same trips.
        </li>
      </Step>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="mb-1 font-semibold">Good to know</p>
        <ul className="ml-5 list-disc space-y-1 leading-relaxed">
          <li>These numbers are good estimates, not exact measurements.</li>
          <li>We assume drivers followed every tip.</li>
          <li>Public charges far away from the hub can&apos;t be moved, so they stay public.</li>
          <li>
            The battery calculator is based on lab tests of similar batteries. The difference
            between 100% and the cap is more reliable than the exact numbers.
          </li>
          <li>Nothing here changes anything on the real vehicles.</li>
        </ul>
      </div>
    </div>
  );
}

function Backtest({ gid }: { gid: string }) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  // The page remounts this per group (key={gid}), so state starts fresh
  useEffect(() => {
    api
      .backtestStatus(gid)
      .then((s) => {
        if (s.status === "running") setRunning(true);
        else if (s.status === "done" && s.result) {
          setResult(s.result);
          setStartedAt(s.finished_at ?? null);
        } else if (s.status === "error") setError(s.error ?? "backtest failed");
      })
      .catch((e) => setError(String(e)));
  }, [gid]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const s = await api.backtestStatus(gid);
        if (s.status === "done" && s.result) {
          setResult(s.result);
          setStartedAt(s.finished_at ?? null);
          setRunning(false);
        } else if (s.status === "error") {
          setError(s.error ?? "backtest failed");
          setRunning(false);
        }
      } catch (e) {
        setError(String(e));
        setRunning(false);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [running, gid]);

  const run = useCallback(async () => {
    setError(null);
    try {
      await api.startBacktest(gid);
      setRunning(true);
    } catch (e) {
      setError(String(e));
    }
  }, [gid]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {startedAt ? (
            <>
              Ran{" "}
              <span className="font-mono text-slate-700">
                {new Date(startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>{" "}
              IST. Not saved; re-run after an API restart.
            </>
          ) : (
            " "
          )}
        </p>
        <button
          onClick={run}
          disabled={running}
          className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-soft disabled:opacity-60"
        >
          {running ? "Running backtest… (a few minutes)" : result ? "Run again" : "Run backtest"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Backtest failed: {error}
        </div>
      )}
      {!result && !running && !error && (
        <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-600">
          Replays this fleet&apos;s full history as if our SOC caps and charging suggestions had been
          used from the start. Click <span className="font-medium text-slate-700">Run backtest</span>.
        </div>
      )}
      {result && <Result r={result} />}
    </>
  );
}

const TABS = [
  { id: "results", label: "Results" },
  { id: "how", label: "How it works" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BacktestPage() {
  const { gid, groupName } = useGroup();
  const [tab, setTab] = useState<TabId>("results");
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          {groupName || "…"}
        </p>
        <h1 className="text-xl font-semibold">Backtest</h1>
        <p className="mt-1 text-sm text-slate-500">
          What this fleet would have gained if it had followed our SOC caps and charging suggestions
          from the start of its data: energy saved, battery range kept and charging moved from public
          chargers to its own hubs.
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

      {tab === "how" ? (
        <HowItWorks key={gid ?? ""} gid={gid} name={groupName} />
      ) : (
        gid && <Backtest key={gid} gid={gid} />
      )}
    </div>
  );
}
