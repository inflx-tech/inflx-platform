# Marketing Engine — Cutover Guide

Step-by-step plan for switching from the v1 (System A + cross-platform
sync) marketing engine to v2 (unified inside Inflx Platform).

**At the end of cutover:** v1 workflows are off, v2 workflows are on,
admin uses Inflx Admin → Marketing for everything, the Google Sheet is
no longer the intake mechanism, and System A's separate Supabase is no
longer consulted.

---

## Pre-cutover Checklist

Before flipping any switches, confirm all of these:

- [ ] Phases 1–5 deployed to production
  - [ ] Migrations 040–043 applied (already done — verify with
    `node backend/scripts/run-040-041-042-043.js` returning all ✓)
  - [ ] Backend deployed with new INGEST endpoints + admin marketing API
  - [ ] Admin web deployed with the `/dashboard/marketing/*` pages
- [ ] n8n project has all required state:
  - [ ] Credential **Apify Query Auth (aveen account)** present
  - [ ] Credential **Anthropic API (topped-up account)** present
  - [ ] Variable `INFLX_INGEST_API_BASE` set to
    `https://inflx-platform.onrender.com/v1/internal/ingest`
    (or the production URL once DNS migration is complete)
  - [ ] Variable `INFLX_INGEST_TOKEN` matches the backend's
    `INFLX_INGEST_TOKEN` env var
  - [ ] Variable `N8N_BASE_URL` set to `https://inflx18.app.n8n.cloud`
- [ ] Backend env has `N8N_BASE_URL` set so admin intake can fire the
  A2 webhook

---

## Cutover Steps

### Step 1 — Import v2 workflow JSONs into n8n

In n8n Cloud → Workflows → Import from File. Import in this order so
inter-workflow webhook URLs resolve cleanly:

1. `n8n/v2/A6_v2.json`
2. `n8n/v2/A5_v2.json`
3. `n8n/v2/A5b_v2.json`
4. `n8n/v2/A25_v2.json`
5. `n8n/v2/A3_v2.json`
6. `n8n/v2/A2_v2.json`

After import, each shows as **inactive** (`active: false`). Don't
activate them yet.

### Step 2 — Deactivate v1 workflows

In n8n, find these and toggle them OFF (do NOT delete — keep for one
week as rollback):

- A1 — Google Sheet Watcher
- A2 — Profile Scraper (v1)
- A3 — Post Scraper (v1)
- A2.5 — Metrics Calculator (v1)
- A2.6 — Cross-Platform Sync
- A4 — Brand Auto-Discovery (already off, confirm)
- A4b — Influencer Auto-Discovery (already off, confirm)
- A5 — Influencer Scoring (v1)
- A5b — Brand Scoring (v1)
- A6 — Daily Refresh (v1)
- A7 — Daily Cleanup *(stays off until cleanup moves into Inflx as a cron job)*
- A9.8 — Daily INGEST Health Ping
- A99 — Monday Safety Sync

Any B-series workflow that was active also goes off (per scope decision,
outreach stays manual).

### Step 3 — Activate v2 workflows

In n8n, toggle these ON:

- A2 v2 — Profile Scraper
- A3 v2 — Post Scraper + Collab/Caption Extractor
- A2.5 v2 — Metrics Calculator
- A5 v2 — Influencer Scoring
- A5b v2 — Brand Scoring
- A6 v2 — Daily Refresh

### Step 4 — Smoke test

1. Open Inflx Admin → Marketing → Add Lead.
2. Add a single test handle (pick one that's safe to scrape).
   - Type: Influencer
   - Handle: `<your_test_handle>`
   - City: any
   - Niche: any
   - No phone/email needed for the test
3. Submit. Toast should show "✓ Added!" with scrape_triggered=true.
4. Open Marketing → Triage. Row should appear with "Scraping…" badge.
5. Wait 2–3 minutes. Refresh. Row should now show:
   - Followers count populated
   - Tier and priority score visible
   - Click "Open →" to see the detail page
6. On the detail page, verify:
   - Bio, profile pic, followers, etc. all populated
   - Score rationale (paragraph from Claude) appears
   - 60+ metrics panel populated
   - Collabs panel populated (if the test creator has any)
   - Activity timeline empty (no activity logged yet)
7. Log a test activity:
   - Channel: DM, Direction: outbound, Body: "test outreach"
8. Status auto-advances to `contacted`. Activity row appears in timeline.

If anything fails, the rollback procedure is in the next section.

### Step 5 — Repeat for a brand

Same test but Target: Brand. Verify:
- Brand appears in Triage with brand badge (B).
- Detail page shows brand-style panel (no 60+ metrics, but
  "Influencer Partnerships" panel).
- Score and tier populated.

### Step 6 — Settings sanity check

Open Marketing → Settings (as superadmin). Confirm all defaults are
visible and editable. Don't change anything yet.

### Step 7 — Funnel and Inbox

Open Marketing → Funnel. Both Influencers and Brands columns should
show counts. Most leads will be in `not_contacted` initially; one
should be in `contacted` from your smoke test.

Open Marketing → Inbox. Should be empty (no follow-ups set yet).

### Step 8 — Rotate the INGEST token (optional, recommended)

Once smoke tests pass, rotate `INFLX_INGEST_TOKEN` to a fresh value:

1. Generate: `openssl rand -hex 32`
2. Update Railway env on Inflx backend.
3. Update n8n Variable `INFLX_INGEST_TOKEN`.
4. Deactivated v1 workflows will start failing on their next execution
   (which never comes because they're off). This is a clean cut — any
   accidental re-activation will fail immediately.

### Step 9 — Tell the operator

The Google Sheet is no longer the intake. From now on, leads enter via
**Inflx Admin → Marketing → Add Lead**.

The old Sheet can remain as a working spreadsheet (for personal notes,
bulk drafting before paste, etc.) but Inflx ignores it.

---

## Rollback Procedure

If smoke tests fail and you need to revert:

1. Toggle all v2 workflows OFF in n8n.
2. Toggle the v1 workflows ON (A1, A2, A3, A2.5, A2.6, A5, A5b, A6, A9.8, A99).
3. Confirm the v1 `INFLX_INGEST_TOKEN` value is still what it was
   before the cutover (don't rotate before rollback).
4. Investigate the failure. Common causes:
   - `INFLX_INGEST_TOKEN` mismatch between n8n variable and backend env
   - `INFLX_INGEST_API_BASE` pointing to wrong URL
   - n8n variable not picking up changes — try a manual workflow
     execution from the n8n UI to confirm vars resolve

The new migrations (040–043) are additive — they don't need to be
rolled back. The new INGEST endpoints and admin marketing API don't
break existing v1 traffic. So you can sit in "rollback mode" indefinitely
while diagnosing.

---

## Post-Cutover Tasks (within one week)

- [ ] Run a full week of v2 in parallel observation. Compare daily
  refresh log against historical v1 behaviour.
- [ ] Delete (or archive) the deactivated v1 workflows in n8n once
  you're confident.
- [ ] Move A7 Cleanup into Inflx Platform as a node-cron job (cleaner
  than keeping it in n8n).
- [ ] Optionally: build the credential rotation UI in Inflx Admin
  (calls n8n API to update Apify / Anthropic credentials without
  logging into n8n).
- [ ] Optionally: build the "force refresh" / "pause job" admin
  controls in Marketing → Settings (calls n8n API to toggle workflow
  active state).

---

## Quick Reference — What's Where

| Concern | Location |
|---|---|
| New tables | `backend/migrations/040–043` |
| INGEST API | `backend/src/controllers/ingest.controller.js`, `backend/src/routes/ingest.routes.js` |
| Admin Marketing API | `backend/src/controllers/marketingAdmin.controller.js`, `backend/src/routes/marketingAdmin.routes.js` |
| Admin UI | `Packages/admin-web/app/dashboard/marketing/` |
| n8n v2 workflows | `n8n/v2/*.json` |
| Architecture doc | `Docs/MARKETING_ENGINE.md` |
| This cutover guide | `Docs/MARKETING_ENGINE_CUTOVER.md` |
