# Logbook Companion — ChatGPT MCP Connector

**Status:** scaffolded and verified against live Supabase (read-only).
**Location:** `api/mcp.ts` + `api/_lib/logbook.ts` (Vercel serverless, not part of the Vite bundle).

## What this is

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that lets
ChatGPT (Developer Mode custom connector) query one athlete's training history
conversationally — "compare the 8 weeks before my best 2k with my last 8 weeks",
"how has my weekly volume changed", etc.

This is the "Parallel Track — Logbook Companion ChatGPT Integration" from
`docs/Midlife-Evidence-Platform-V2-Plan.md`. It is deliberately the smaller,
earlier-value problem, and a low-stakes dry run for the Evidence Platform's later
MCP layer (Phase 7).

Because it queries **our own app and our own Supabase**, none of the Strava/Garmin
third-party API policy constraints apply (see `docs/strava-sync-feasibility.md`).

## Architecture

```
ChatGPT  ──HTTPS / MCP (Streamable HTTP)──▶  /api/mcp  ──▶  Supabase (workout_logs)
             Authorization: Bearer <token>   Vercel fn       service-role, code-scoped
```

- **Transport:** stateless Streamable HTTP via the official `@modelcontextprotocol/sdk`.
  One `McpServer` + `StreamableHTTPServerTransport` per request, `sessionIdGenerator:
  undefined`, `enableJsonResponse: true`. No Redis, no session store (SSE would require
  Redis on Vercel — we don't use it).
- **Handler:** `api/mcp.ts` — a native Vercel Node function (`export const config = {
  runtime: 'nodejs' }`). POST only; GET/DELETE are rejected (only needed by the
  stateful/session transport we don't use).
- **Data access:** `api/_lib/logbook.ts` — self-contained Supabase queries. It **must
  not** import from `src/`: the app's Supabase client reads `import.meta.env` and is
  browser-scoped.
- **Build isolation:** `api/tsconfig.json` keeps this out of the Vite build; the SPA
  bundle contains none of this code.

## Security model (read this before going multi-user)

This connector is **single-athlete only** in its current shape.

- It uses the Supabase **service-role key**, which **bypasses Row Level Security**.
- Per-user scoping therefore lives **in code**, not in the database: every query in
  `logbook.ts` filters `.eq('user_id', LOGBOOK_USER_ID)`.
- This is an acceptable trade for a personal, one-athlete tool. It is **not** safe to
  expose to multiple users in this form — a bug in scoping would leak across athletes.
- **To serve more than one athlete:** switch to per-user OAuth, have ChatGPT obtain a
  per-user token, pass the user's Supabase JWT through to the query client, and let
  **RLS** enforce scoping instead of code. That is a different (larger) build.

Auth is a single shared **bearer token** (`MCP_BEARER_TOKEN`). ChatGPT sends it as
`Authorization: Bearer <token>`; the handler strips the `Bearer ` prefix and compares
the remainder to the env value. The stored value is the **raw secret only** — the word
"Bearer" is the HTTP scheme name and is never part of the token value.

## Environment variables

Server-side only. **Never** prefix any of these with `VITE_` — Vite inlines `VITE_*`
vars into the browser bundle, which would ship the service-role key to every visitor.

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL. Falls back to `VITE_SUPABASE_URL` if unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS — server-side only). |
| `LOGBOOK_USER_ID` | The single athlete's `auth.users` UUID. All queries are scoped to this. |
| `MCP_BEARER_TOKEN` | Shared secret for connector auth. Raw string only, no "Bearer" prefix. Generate with `openssl rand -hex 32`. |
| `MCP_DISABLE_AUTH` | Optional. `"true"` skips bearer auth for **local testing only**. Never set in prod. |

### Local (`.env.local`)

```
SUPABASE_SERVICE_ROLE_KEY=...
LOGBOOK_USER_ID=...
MCP_BEARER_TOKEN=...            # openssl rand -hex 32, raw value only
# SUPABASE_URL reuses VITE_SUPABASE_URL from .env
```

### Vercel

Project → Settings → Environment Variables. Add `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `LOGBOOK_USER_ID`, `MCP_BEARER_TOKEN`. Scope to
Production (and Preview if you want the connector live on preview deploys). Redeploy
after adding — env changes don't apply to existing deployments.

## Tools

All read-only. Distances are meters, durations seconds, `avg_split_500m` is seconds
per 500m, `watts` is average power.

| Tool | Purpose |
|---|---|
| `search_workouts` | Filtered session list (date, type, zone, source, name, distance, duration). |
| `get_workout` | Full detail for one session by UUID or Concept2 `external_id`, incl. interval structure. |
| `get_training_summary` | Rollup over a range: totals + breakdowns by type, zone, source. |
| `get_performance_trend` | Weekly trend (sessions, distance, duration, avg watts, avg HR). |
| `compare_training_periods` | Two windows A vs B + deltas. Highest-value tool. |
| `get_benchmark_history` | History of a named effort (e.g. `2000m`, `30:00`), newest first. |
| `list_benchmarks` | Distinct canonical workout names + attempt counts (discovery). |

### Data notes (observed on live data)

- `workout_type` values are e.g. `rower`, `cross_training`, `strength` — **not** `erg`.
- `training_zone` is frequently unset on logged sessions, so zone filters and the
  zone breakdown in `get_training_summary` can be sparse/empty. This is upstream data,
  not a connector bug.
- Benchmarks are keyed off `canonical_name` (there is no `is_benchmark` column). A
  `canonical_name` of `Unknown` exists for unclassified sessions.

## Connecting from ChatGPT

1. Deploy so the route is live at `https://<your-app>/api/mcp`.
2. ChatGPT → **Settings → Apps & connectors → Advanced → Developer Mode** (toggle on).
3. Add a custom connector:
   - **URL:** `https://<your-app>/api/mcp`
   - **Auth:** OAuth
   - **Token:** paste `MCP_BEARER_TOKEN` (raw value) as the static access token.
4. Ask a training question; ChatGPT will call the tools.

ChatGPT Developer Mode supports arbitrary named read/write tools (the `search`/`fetch`
-only restriction applies only to deep-research mode, which this does not use).

## Local verification

The handshake and live queries were validated with a throwaway harness that mounts the
handler on a local HTTP server and drives `initialize` → `tools/list` → `tools/call`.
To re-verify:

- Typecheck: `npx tsc -p api/tsconfig.json`
- Lint: `npx eslint api/`
- App build unaffected: `npm run build` (excludes `api/`)

For a live data check, write a small `.mts` under `api/` that loads `.env` + `.env.local`,
imports the default handler, and POSTs MCP JSON-RPC with the bearer header. Delete it
after — do not commit test harnesses.

## Not yet done

- No git commit (untracked `api/`).
- Not deployed to Vercel.
- Not wired into ChatGPT.
- Single-athlete only — see security model before any multi-user move.
