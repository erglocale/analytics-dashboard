"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGroup } from "@/lib/group-context";

const NAV = [
  { href: "/suggestions", label: "SOC caps", hint: "per-vehicle charge limits" },
  { href: "/charging", label: "Charging", hint: "realtime nudges & settings" },
  { href: "/docs", label: "Docs", hint: "how it works" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { groups, gid, setGid, error } = useGroup();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-100 bg-white">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <Image src="/ergos.png" alt="ergOS" width={90} height={40} priority />
        <span className="mt-1 text-xs font-medium text-slate-400">Analytics</span>
      </div>

      <div className="px-5 py-3">
        <label
          htmlFor="group-select"
          className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400"
        >
          Fleet group
        </label>
        <select
          id="group-select"
          value={gid ?? ""}
          onChange={(e) => setGid(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-2 text-xs text-red-700">
            API unreachable — start it with{" "}
            <code className="font-mono">uvicorn api:app --port 8000</code> in{" "}
            <code className="font-mono">analytics/</code>.
          </p>
        )}
      </div>

      <nav className="flex-1 px-3 py-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 block rounded-md px-3 py-2 ${
                active ? "bg-brand-soft" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`block text-sm font-medium ${active ? "text-brand-dark" : "text-slate-700"}`}
              >
                {item.label}
              </span>
              <span className={`block text-xs ${active ? "text-brand-dark/70" : "text-slate-400"}`}>
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Times shown in IST
      </div>
    </aside>
  );
}
