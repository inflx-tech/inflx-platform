# n8n Workflows — v2 (Unified Marketing Engine)

These workflow JSONs replace the System-A versions in
`OneDrive/Inflx-Automations/workflows/`. The v2 set talks to Inflx
Platform's INGEST API instead of System A's Supabase. All writes are
mediated by Inflx; n8n no longer holds Supabase credentials.

## What's in this folder

| File | Replaces | Purpose |
|---|---|---|
| `A2_v2.json` | A2 | Profile Scraper — Apify profile + Claude bio intel → POST `/creator-metrics` or `/brand-metrics` |
| `A3_v2.json` | A3 | Post Scraper + Collab Extractor — Apify posts + Claude analysis → POST `/posts`, `/caption-insights`, `/collab-map`, `/brand-collabs` |
| `A2.5_v2.json` | A2.5 | Metrics Calculator — GET `/profile-bundle`, compute 60+ metrics, POST `/creator-metrics` |
| `A5_v2.json` | A5 | Influencer Scoring — Claude scores 0–100, POST `/creator-metrics` + `/insight-log` |
| `A5b_v2.json` | A5b | Brand Scoring — Claude scores 0–100, POST `/brand-metrics` + `/insight-log` |
| `A6_v2.json` | A6 | Daily Refresh — GET `/refresh-due`, fires A2 webhook per due handle |

## What's retired (do NOT import to n8n)

- **A1** — Google Sheet Watcher. Replaced by admin intake form in Inflx
  Admin (`POST /admin/marketing/leads/intake`).
- **A4 / A4b** — auto-discovery cascades. Killed per kill-auto-discovery
  decision.
- **A2.6** — cross-platform sync. No longer needed (one DB now).
- **A9.8** — INGEST health ping. No longer needed (Inflx monitors itself).
- **A99** — Monday safety sync. No longer needed (no cross-system drift).
- **A7** — Cleanup. Moving to in-platform node-cron in Phase 6.

## What stays dormant

All B-series workflows (B1–B14, B3 listener, B3 intro writer, B11b).
Outreach is manual per scope decision. These stay in n8n but inactive.

## Import order (cutover)

1. Verify n8n has these Credentials + Variables (covered in Phase 1
   inspection notes — already in place):
   - **Credentials:** "Apify Query Auth (aveen account)",
     "Anthropic API (topped-up account)"
   - **Variables:** `INFLX_INGEST_API_BASE`, `INFLX_INGEST_TOKEN`,
     `N8N_BASE_URL`
2. In n8n: Workflows → Import from File. Import in this order so the
   inter-workflow webhook URLs resolve cleanly:
   1. `A6_v2.json`
   2. `A5_v2.json`
   3. `A5b_v2.json`
   4. `A2.5_v2.json`
   5. `A3_v2.json`
   6. `A2_v2.json`
3. After all are imported, **deactivate** the old A1, A2, A3, A2.5, A2.6,
   A4, A4b, A5, A5b, A6, A9.8, A99 in n8n. Do not delete — keep them
   for one week as rollback.
4. **Activate** all six v2 workflows.
5. Smoke-test by adding one handle via Inflx Admin → Marketing → Add Lead.
   Watch it propagate through A2 → A3 → A2.5 → A5 within ~3 minutes.
6. Rotate the INFLX_INGEST_TOKEN if you want a clean cut (regenerate on
   Inflx side, update the n8n Variable). Old workflows will start
   failing immediately, confirming the cutover.

## How v2 differs from v1, at a glance

- No `$vars.SUPABASE_URL` / `$vars.SUPABASE_SERVICE_ROLE_KEY` references
  anywhere. n8n doesn't talk to Supabase.
- Every write goes through `POST $vars.INFLX_INGEST_API_BASE/<endpoint>`
  with `X-Ingest-Token: $vars.INFLX_INGEST_TOKEN` header.
- Every read goes through `GET $vars.INFLX_INGEST_API_BASE/<endpoint>`.
- A2.5's three Supabase fetches collapse to one `GET /profile-bundle/:handle`.
- A6's hardcoded settings string is gone — it reads from `/refresh-due`
  which uses the seeded `system_settings` row in Inflx Supabase.
- Manual-vs-Claude separation is preserved: the workflows write only to
  `inferred_*` columns, never to admin's `city`/`niche`/`manual_*`.

## After the cutover

The v1 JSONs in `OneDrive/Inflx-Automations/workflows/` stay as a
historical reference. They will not work after `INFLX_INGEST_TOKEN`
rotation — leave them alone, don't reactivate them.
