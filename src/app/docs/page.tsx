"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

const TABS = [
  { id: "charging", label: "Charging suggestions" },
  { id: "prediction", label: "Trip prediction" },
  { id: "cap", label: "SOC cap parameters" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// The docs cross-reference each other by repo filename; map the ones this UI
// serves to their tab so those links switch tabs instead of 404ing.
const MD_TABS: Record<string, TabId> = {
  "REALTIME_SUGGESTION.md": "charging",
  "TRIP_PREDICTION.md": "prediction",
  "CAP_PARAMETERS.md": "cap",
};

export default function DocsPage() {
  const [tab, setTab] = useState<TabId>("charging");
  const [docs, setDocs] = useState<Partial<Record<TabId, string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (docs[tab]) return;
    setError(null);
    api
      .doc(tab)
      .then((d) => setDocs((curr) => ({ ...curr, [tab]: d.markdown })))
      .catch((e) => setError(String(e)));
  }, [tab, docs]);

  const md = docs[tab];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          Documentation
        </p>
        <h1 className="text-xl font-semibold">How it works</h1>
        <p className="mt-1 text-sm text-slate-500">
          The same reference docs that live in the analytics repo, always in sync with the engine.
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Couldn&apos;t load the doc: {error}
        </div>
      )}
      {!error && !md && <p className="text-sm text-slate-500">Loading…</p>}
      {md && (
        <article className="doc-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const file = (href ?? "").split("/").pop() ?? "";
                const target = MD_TABS[file];
                if (target)
                  return (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setTab(target);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      {children}
                    </a>
                  );
                if (/^https?:/.test(href ?? ""))
                  return (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  );
                // Repo-only doc with no tab here — show the name, not a dead link.
                return <span>{children}</span>;
              },
            }}
          >
            {md}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
