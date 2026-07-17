"use client";

import { useGroup } from "@/lib/group-context";

export default function FleetPage() {
  const { groupName } = useGroup();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          {groupName || "…"}
        </p>
        <h1 className="text-xl font-semibold">Fleet</h1>
      </header>
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Coming in phase 2.</p>
        <p className="mt-2">
          The whole-fleet operation view (utilisation, contention, hub load) migrates after Past
          analysis. Until then this view lives in the Streamlit app.
        </p>
      </div>
    </div>
  );
}
