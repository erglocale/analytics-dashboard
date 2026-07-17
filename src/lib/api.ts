const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function post<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { method: "POST" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export type Group = { id: string; name: string; hostType: string | null };

export type CapRow = {
  ev_id: number;
  label: string;
  suggested_cap: number;
  lowest_safe_cap: number;
  unsafe_pct: number;
  structural_pct: number | null;
  tolerance_pct: number | null;
  operating_days: number;
  confidence: "High" | "Medium" | "Low";
  note: string;
  sweep: { cap: number; added_pct: number }[] | null;
  window_from: string;
  window_to: string;
  computed_at: string;
};

export type ParamsResponse = {
  defaults: Record<string, unknown>;
  saved: Record<string, unknown>;
  effective: Record<string, unknown>;
};

export type Evaluation = {
  ev_id: number;
  label: string;
  status: "nudge" | "wait" | "skip";
  distance_km: number | null;
  within_radius: boolean;
  reason: string;
  slack_min?: number;
  rank?: number;
};

export type Nudge = {
  ev_id: number;
  label: string;
  hub: string;
  soc: number;
  target_cap: number;
  predicted_free_min: number | null;
  charge_time_min: number;
  slack_min: number;
  trigger: string;
  rank: number;
};

export type Preview = {
  hour: number;
  nudges: Nudge[];
  evaluations: Evaluation[];
  ports: Record<string, number>;
  free_ports: Record<string, number>;
  source: "ocpp" | "config";
};

export type CapRecompute = {
  status: "idle" | "running" | "done" | "error";
  started_at?: string;
  finished_at?: string;
  error?: string;
  days?: number;
  window_from?: string;
  window_to?: string;
  caps?: CapRow[];
};

// v2 is the 48 half-hour-slot payload; older rows may still hold the legacy
// 24 hourly medians until the next offline run replaces them.
export type DeparturePayload =
  | { v: 2; slot_min: number; p50: number[]; p25: number[] }
  | (number | null)[]
  | null;

export type ProfileRow = {
  ev_id: number;
  label: string;
  departure_min: DeparturePayload;
  window_from: string;
  window_to: string;
  computed_at: string | null;
};

export type ProfileRecompute = {
  window_from: string;
  window_to: string;
  computed_at: string;
  profiles: Pick<ProfileRow, "ev_id" | "label" | "departure_min">[];
};

export type NudgeHistoryRow = {
  id: number;
  ev_id: number;
  label: string;
  hub: string;
  soc: number;
  target_cap: number;
  slack_min: number;
  rank: number;
  reason: string;
  outcome: "plugged_in" | "left" | "ignored" | null;
  plugged_in: boolean | null;
  plugged_in_at: string | null;
  soc_gain: number | null;
  created_at: string;
};

export const api = {
  groups: () => get<Group[]>("/api/groups"),
  socCaps: (gid: string) => get<CapRow[]>(`/api/groups/${gid}/soc-caps`),
  params: (gid: string) => get<ParamsResponse>(`/api/groups/${gid}/params`),
  saveParams: async (gid: string, params: Record<string, unknown>) => {
    const r = await fetch(`${BASE}/api/groups/${gid}/params`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  },
  nudgePreview: (gid: string) => get<Preview>(`/api/groups/${gid}/nudges/preview`),
  nudgeHistory: (gid: string, hours = 168) =>
    get<NudgeHistoryRow[]>(`/api/groups/${gid}/nudges?hours=${hours}`),
  startCapRecompute: (gid: string) =>
    post<{ status: string }>(`/api/groups/${gid}/soc-caps/recompute`),
  capRecomputeStatus: (gid: string) =>
    get<CapRecompute>(`/api/groups/${gid}/soc-caps/recompute`),
  publishCaps: (gid: string) => post<{ published: number }>(`/api/groups/${gid}/soc-caps/publish`),
  profiles: (gid: string) => get<ProfileRow[]>(`/api/groups/${gid}/profiles`),
  recomputeProfiles: (gid: string) =>
    post<ProfileRecompute>(`/api/groups/${gid}/profiles/recompute`),
  publishProfiles: (gid: string) =>
    post<{ published: number }>(`/api/groups/${gid}/profiles/publish`),
  doc: (id: string) => get<{ id: string; title: string; markdown: string }>(`/api/docs/${id}`),
};
