# Inflx Marketing Engine — Architecture & Operations

**Version:** v2 (unified into Inflx Platform)
**Last updated:** 2026-05-14
**Status:** Implementation complete; awaiting cutover

---

## What the Marketing Engine Is

The Marketing Engine is the part of Inflx that **discovers Instagram
handles, enriches them with scraping + AI analysis, scores them, and
tracks every outreach conversation** until the lead either signs up on
the platform or is marked dead.

It powers the **Marketing** section of Inflx Admin (`/dashboard/marketing/*`).

It handles both **influencers** (people creating content) and **brands**
(businesses that may want to hire creators).

It's **not** an automated outreach system. Admins log every conversation
manually. The engine doesn't send DMs, doesn't auto-classify replies,
doesn't run Instagram OAuth.

---

## Why "v2"

There was a v1 of this system that lived in a separate Supabase
("System A") with n8n workflows pushing influencer data into Inflx
through a token-authenticated INGEST API. Two databases, two source-of-
truth questions, weekly reconciliation, daily health pings, brand data
stranded in System A.

v2 collapses everything into the **one** Inflx Platform Supabase.
n8n stays as the execution engine (Apify + Claude calls), but it no
longer holds Supabase credentials — every write goes through the
extended INGEST API. The reconciliation, cross-platform sync, and
health-ping workflows are retired.

Brands also become first-class: they live in their own `brand_profiles`
table (separate from the existing `brands` table of registered platform
customers) and flow through the same triage + tracking workspace as
influencers.

---

## Data Flow (End-to-End)

```
┌──────────────────┐     POST /admin/marketing/leads/intake
│  Inflx Admin UI  │ ─────────────────────────────────────────► ┌──────────────┐
│  Marketing → Add │                                             │   Inflx      │
└──────────────────┘                                             │  Backend     │
                                                                 │  (Express)   │
                                                                 └──────┬───────┘
                                                                        │
                                                                        ▼
                                                                 ┌──────────────┐
                                                                 │  Supabase    │
                                                                 │  (one DB)    │
                                                                 │              │
                                                                 │  creator_    │
                                                                 │  profiles    │
                                                                 │  brand_      │
                                                                 │  profiles    │
                                                                 │  posts       │
                                                                 │  caption_    │
                                                                 │  insights    │
                                                                 │  collab_map  │
                                                                 │  insights    │
                                                                 │  outreach_   │
                                                                 │  activity    │
                                                                 │  system_     │
                                                                 │  settings    │
                                                                 └──────┬───────┘
                                                                        │
                                                                        ▲
                                                                        │
                                                       POST /v1/internal/ingest/*
                                                       (X-Ingest-Token authenticated)
                                                                        │
                                  ┌─────────────────────────────────────┴────────────┐
                                  │                                                  │
                                  ▼                                                  ▼
                         ┌─────────────────┐                              ┌─────────────────┐
                         │  n8n Workflow   │ ◄──── webhook ────────────── │  Inflx Backend  │
                         │  Engine         │      (POST a2-profile-      │  fires A2 after │
                         │                 │       scraper, etc.)         │  intake insert  │
                         │  A2  Profile    │                              └─────────────────┘
                         │  A3  Posts      │
                         │  A2.5 Metrics   │
                         │  A5  Inf Score  │
                         │  A5b Br Score   │
                         │  A6  Refresh    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Apify          │
                         │  (IG scraping)  │
                         │                 │
                         │  Anthropic      │
                         │  Claude         │
                         │  (AI analysis)  │
                         └─────────────────┘
```

The arrows in/out of Supabase are **only through the INGEST API**.
n8n never opens a direct Postgres connection in v2.

---

## Database Schema (Marketing-Specific Tables)

### `creator_profiles` (existing, extended in migration 043)

Scraped/discovery influencers. One row per IG handle.

- **Identity:** `ig_handle UNIQUE`, `ig_user_id`, `full_name`, `bio`.
- **Manual fields (admin-typed at intake):** `city`, `niche`, `sub_niche`,
  `manual_phone`, `manual_email`, `manual_whatsapp`. **Never overwritten
  by AI scrapes.**
- **Claude-inferred:** `inferred_city`, `inferred_niche`,
  `inferred_sub_niche`, `bio_phone`, `bio_email`, `bio_whatsapp`,
  `primary_offering`, `tone`, `bio_business_type`, `reachability_score`,
  `contact_intel_extracted_at`. **Always rewritten on each scrape.**
- **Snapshot:** `followers_count`, `following_count`, `bio`,
  `profile_pic_url`, `external_url`, `is_verified`, `is_business`,
  `is_private`, `ig_category`.
- **Metrics (60+):** `follower_based_er`, `view_based_er`, `avg_likes`,
  `avg_views`, `total_posts_90d`, `posting_frequency_per_*`,
  `consistency_score`, `total_brand_collaborations`,
  `unique_brands_count`, `commercial_post_rate`, `cta_usage_rate`,
  `brand_diversity_score`, `top_brand_partners` (JSONB),
  `growth_potential_score`, `rank_score`, plus rate-range estimates in
  rupees (`estimated_min_rate`, `estimated_max_rate`).
- **Scoring:** `priority_score` (0–100), `follower_tier`,
  `scoring_summary`, `scoring_strengths` (JSONB), `scoring_concerns`
  (JSONB).
- **Outreach status:** `outreach_status` enum, see state machine below.
- **Lifecycle:** `is_paused`, `paused_at`, `reengagement_date`,
  `is_onboarded`, `linked_influencer_id` (FK to `influencers.id` when
  they register).
- **Audit:** `last_scraped_at`, `last_calculated_at`, `scrape_count`,
  `created_at`, `updated_at`, `source`, `notes`.
- **Verification (existing):** `verification_status` 4-state machine
  for claim flow (unused in current marketing engine scope).

### `brand_profiles` (migration 040, new)

Scraped/discovery brands. Mirror of `creator_profiles` but lighter — no
60+ metrics, no rate range, no claim flow. Same manual-vs-inferred
column separation. `linked_brand_id` FKs to the existing `brands` table
when a discovery brand eventually registers.

### `posts` (existing, migration 025)

Per-post records linked to `creator_profiles`. Used by A2.5 metrics
calculator. Brands also write posts here (lighter — 30-day window).

### `caption_insights` (migration 041, new)

Per-post AI-extracted insights for influencers (commercial intent, CTA,
content theme, funnel stage, etc.). One row per `post_shortcode`.

### `collab_map` (migration 041, new)

Detected brand collaborations on influencer posts. One row per
`(creator_profile_id, post_shortcode)`. Powers the "top brand partners"
panel.

### `insights` (migration 041, new)

Append-only log of AI runs and daily reports. Used by A5/A5b scoring
and any future daily report job.

### `system_settings` (migration 041, new)

Single-row config table (CHECK id=1):
- `high_tier_threshold` / `low_tier_threshold` — priority score cutoffs
- `high/mid/low/brand_refresh_days` — daily refresh cadence
- `skip_recent_scrape_hours` — freshness gate (default 24)
- `posts_retention_days`, `brand_posts_retention_days`
- `discovery_enabled` (default FALSE — auto-cascade discovery is killed)

### `outreach_activity` (migration 042, new)

Every manual touch with a lead. Channel, direction, message body,
sentiment, internal notes, next-action, due date, logged-by admin.
The `outreach_status` column on creator/brand profiles is the *derived*
state; this log is the source of truth.

---

## Status State Machine

```
                                    ┌────────────────────────────┐
                                    │                            │
                                    ▼                            │
                            ┌──────────────┐                     │
                            │ not_contacted│                     │
                            └──────┬───────┘                     │
                                   │ first outbound activity     │
                                   ▼                             │
                            ┌──────────────┐                     │
                            │  contacted   │                     │
                            └──────┬───────┘                     │
                                   │ first inbound activity      │
                                   ▼                             │
                            ┌──────────────┐                     │
                            │   replied    │                     │
                            └──────┬───────┘                     │
                                   │ admin marks                 │
                                   ▼                             │
                            ┌──────────────┐                     │
                            │  interested  │                     │
                            └──────┬───────┘                     │
                                   │                             │
                                   ▼                             │
                            ┌──────────────┐                     │
                            │ negotiating  │                     │
                            └──────┬───────┘                     │
                                   │ signup matches lead OR      │
                                   │ admin marks                 │
                                   ▼                             │
                            ┌──────────────┐                     │
                            │  registered  │  ← terminal (good)  │
                            └──────────────┘                     │
                                                                 │
       ┌─────────────────────────────────────────────────────────┴┐
       │                                                          │
       ▼                                                          ▼
┌──────────────┐                                          ┌──────────────┐
│     dead     │ ← terminal (bad), can be revived via     │   paused     │
│              │   admin intake → force_action=revive     │ (temporary)  │
└──────────────┘                                          └──────────────┘
```

Quick-status buttons enforce the allowed transitions. A `force=true`
override is available for admin-only edge cases.

Every status change writes an `internal_note` row to `outreach_activity`
for audit.

---

## API Surface

### INGEST API (`/v1/internal/ingest/*`, X-Ingest-Token auth)

Used by n8n workflows. Implemented in
`backend/src/controllers/ingest.controller.js`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/creator-metrics` | Upsert one influencer (existing endpoint, now with partial-update semantics) |
| POST | `/posts` | Bulk upsert posts for one influencer |
| POST | `/brand-metrics` | Upsert one brand |
| POST | `/brand-collabs` | Update only the collab fields on one brand |
| POST | `/caption-insights` | Bulk upsert per-post AI insights |
| POST | `/collab-map` | Bulk upsert detected brand collabs |
| POST | `/insight-log` | Append an insight (AI scoring summary, daily report, etc.) |
| GET  | `/profile-bundle/:ig_handle` | One-shot: profile + posts + caption_insights |
| GET  | `/brand-profile/:handle` | One-shot: brand row only (no posts) |
| GET  | `/refresh-due?target_type=&limit=` | Handles due for rescrape per tier cadence |
| GET  | `/settings` | Read system_settings row |
| GET  | `/health` | Total counts + staleness check |

**Manual fields are NOT writable** via the INGEST API. The
`CREATOR_COLUMNS` / `BRAND_COLUMNS` allow-lists exclude `manual_phone`,
`manual_email`, `manual_whatsapp`, `outreach_status`, `is_onboarded`,
`linked_*_id`, and verification fields.

### Admin Marketing API (`/admin/marketing/*`, JWT + admin role auth)

Used by Inflx Admin UI. Implemented in
`backend/src/controllers/marketingAdmin.controller.js`.

| Method | Path | Roles |
|---|---|---|
| POST | `/leads/intake` | reviewer+ |
| POST | `/leads/intake/bulk` | reviewer+ |
| GET | `/leads` (filters, pagination) | any admin |
| GET | `/leads/:type/:id` | any admin |
| POST | `/leads/:type/:id/activity` | reviewer+ |
| PATCH | `/leads/:type/:id/status` | reviewer+ |
| GET | `/inbox` | any admin |
| GET | `/funnel` | any admin |
| GET | `/settings` | any admin |
| PATCH | `/settings` | **superadmin only** |

---

## n8n Workflows (v2)

Stored at `n8n/v2/` in the repo. Import these into the existing
`inflx18.app.n8n.cloud` project when ready to cut over.

| File | Role |
|---|---|
| `A2_v2.json` | Profile Scraper. Webhook → Apify profile → Claude bio intel → POST `/creator-metrics` or `/brand-metrics` → trigger A3 |
| `A3_v2.json` | Post Scraper + Collab Extractor. For influencer: POST `/posts`, `/caption-insights`, `/collab-map`, `/creator-metrics` (counts), trigger A2.5. For brand: lighter 30-day post window, POST `/brand-collabs`, trigger A5b. |
| `A25_v2.json` | Metrics Calculator. GET `/profile-bundle/:handle`, compute 60+ metrics, POST `/creator-metrics`, trigger A5 |
| `A5_v2.json` | Influencer Scoring. GET `/profile-bundle`, Claude scoring prompt, POST score back + POST `/insight-log` |
| `A5b_v2.json` | Brand Scoring. GET `/brand-profile/:handle`, Claude scoring prompt, POST `/brand-metrics` + `/insight-log` |
| `A6_v2.json` | Daily Refresh (cron 03:00 UTC). GET `/refresh-due`, fires A2 v2 webhook per due handle |

n8n only needs **two credentials** (Apify, Anthropic) plus two
variables (`INFLX_INGEST_API_BASE`, `INFLX_INGEST_TOKEN`,
`N8N_BASE_URL`). No Supabase credential needed.

### Retired Workflows

- **A1** (Sheet Watcher) — replaced by admin intake form.
- **A4** / **A4b** (Auto-discovery cascades) — killed.
- **A2.6** (Cross-platform sync) — single DB now, nothing to sync.
- **A9.8** (Ingest health ping) — Inflx monitors itself.
- **A99** (Monday safety sync) — no cross-system drift.
- **A7** (Cleanup) — will move to an in-platform node-cron later.

### Dormant Workflows (kept but never activated)

All B-series workflows (B1–B14). Manual outreach is the explicit scope
decision — these stay in n8n disabled in case we ever want to revive
specific pieces.

---

## Rotation Procedure

### Rotating `INFLX_INGEST_TOKEN`

1. Generate a new token (e.g. `openssl rand -hex 32`).
2. Update Railway env var `INFLX_INGEST_TOKEN` on Inflx backend.
3. Redeploy backend (Railway auto-deploys on env change).
4. Update n8n Variable `INFLX_INGEST_TOKEN` to match.
5. Test: trigger any v2 workflow manually; should succeed.

### Rotating Apify or Anthropic Keys

Update the **n8n Credential** directly in n8n's UI. Workflows reference
credentials by ID, so the ID stays stable.

(Future: do this from Inflx Admin via the n8n API instead of the n8n UI.)

---

## Troubleshooting

### A lead was added but never got enriched

- Open Inflx Admin → Marketing → Triage → click the lead. If
  `last_scraped_at` is NULL and "Scraping…" badge shows, n8n hasn't
  completed yet. Wait ~3 minutes.
- If it's been >10 minutes, check n8n execution log for the A2 webhook
  trigger. Look for Apify errors (rate limit, account suspended).
- Worst case, force a re-trigger by going to Marketing → Add Lead → enter
  same handle → click "Force refresh" in the duplicate-conflict modal.

### Status didn't auto-advance after logging activity

- The state machine only auto-advances on specific transitions:
  - First outbound → `contacted`
  - First inbound when status was `contacted` or `not_contacted` → `replied`
- Beyond that, admin uses quick-status buttons.

### A creator/brand registered but Marketing still shows them in pipeline

- The auto-link logic ties `linked_influencer_id` / `linked_brand_id`
  when registration matches the handle. If matching failed (different
  ig_handle case, etc.), admin can manually mark status `registered`
  via quick-status button on the detail page.

### n8n is firing but writes are silently failing

- Check `insights` table for any failed-payload rows.
- Check backend logs for `INVALID_PAYLOAD` or `TOKEN_REJECTED` errors
  on `/v1/internal/ingest/*`.
- Most common: `INFLX_INGEST_TOKEN` mismatch between n8n variable and
  backend env.

---

## See Also

- **`Docs/MARKETING_ENGINE_CUTOVER.md`** — step-by-step cutover plan.
- **`n8n/v2/README.md`** — n8n import order + per-workflow notes.
- **`backend/migrations/040_brand_profiles.sql`** through **`043_marketing_columns_extra.sql`** — schema source of truth.
- **`backend/src/controllers/ingest.controller.js`** — INGEST API implementation.
- **`backend/src/controllers/marketingAdmin.controller.js`** — Admin API implementation.
