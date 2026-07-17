# ergOS Analytics UI

Next.js replacement for the Streamlit analytics app. Talks to the FastAPI
service in `../analytics/api.py`, which wraps the same Python engine the
scheduled runners use.

## Run

```bash
# 1. the API (from ../analytics — needs its .env with the DB URLs)
uvicorn api:app --port 8000

# 2. this app
pnpm install
pnpm dev            # http://localhost:3000
```

`NEXT_PUBLIC_API_BASE` (in `.env.local`) points at the API — defaults to
`http://127.0.0.1:8000`.

## Pages

- **SOC caps** (`/suggestions`) — stored per-vehicle cap suggestions with the
  backtest sweep as expandable evidence.
- **Charging** (`/charging`) — the realtime nudge settings (saved to
  `suggestion.group_params`, shared with the scheduled runner), a read-only
  live decision preview, and the sent-nudge history with outcomes.
- **Past analysis** / **Fleet** — phase 2 (they need job-queue endpoints for
  the multi-minute simulation runs); until then they live in the Streamlit app.

## Stack

Next.js 16 (App Router, Turbopack), Tailwind v4, Recharts, pnpm.
