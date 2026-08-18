# Audit — step detail, tracking, brand location, product catalogues

Founder questions, 2026-08-15, answered against code and production before any mockup.

1. Detailed info per step — "what happened in each step"
2. After live: tracking (social + platform posts), earnings on this campaign, product sales
3. Brand search must show **where the brand is**
4. Products, **category-wise**, at three scopes: per campaign · per brand · everything

---

## 1 · Step detail — only one step of six keeps a history

| Step | What is stored | History? |
|---|---|---|
| **1 Agree** | `brand_collab_requests.counter_terms_json` — commented *"the latest counter, whoever sent it"* — plus `brand_rounds_used` / `creator_rounds_used`, `viewed_at`, `responded_at` | **No.** Each counter **overwrites** the last |
| **2 Sign** | `contracts` timestamps | No event log |
| **3 Shoot** | **`production_event_log`** — `actor_user_id`, `actor_role`, `action`, `notes`, `metadata`, `created_at` | **Yes — full audit** |
| **4 Shop posts** | `creator_posts.status`, `reject_reason`, `approved_by` | **No.** Latest rejection only |
| **5 Go live** | `deliverables.submitted_at`, `live_confirmed_at`, `revision_count`, `brand_feedback` | **No.** Two revision rounds happen; only the **last** feedback survives |
| **6 Done** | — | Nothing computes completion at all |

### The consequence for what was already mocked

The invitation-thread timeline drawn in `creator-collab-conversations` panel ④ — *"Mokha
asked you 9 Aug · you countered 10 Aug · they accepted 12 Aug"* with the terms at each turn
— **cannot be built from today's schema.** The event *shape* is derivable from
`created_at` / `viewed_at` / `responded_at` / rounds-used, but **the terms at each turn are
gone**, overwritten by the next counter.

This is a genuine defect in the Part 2 design, not a missing feature: a negotiation that
cannot show what was offered is not auditable, and neither side can prove what was said.

### It is already solved twice in this repo

- `negotiation_turns` (migration 001, extended by 018) — the older campaign negotiation flow
- `production_event_log` (migration 024) — the shoot

**Recommendation: one `collab_event_log`**, written by every step, with `actor_role`,
`action`, `terms_snapshot jsonb`, `created_at`. Generalises the pattern that already exists
rather than inventing a third. It is what makes "check what happened in this step" a single
component reused six times instead of six bespoke screens.

---

## 2 · Tracking after live — one of the three exists

### 2a · Social media performance — **exists, but it is a snapshot, not a trend**

`deliverable_stats`: `reach`, `impressions`, `likes`, `comments`, `saves`, `shares`,
`engagement_rate`, `scraped_at`. Filled by Apify, refreshable via
`POST /deliverables/:id/refresh-stats`.

**`UNIQUE(deliverable_id)`** — one row per deliverable. Each scrape **overwrites** the last.
So "how is it doing now" works; **"how did it grow" is impossible**. 1 row in prod.

Fixing that is a row-per-scrape table, not a redesign — but it must happen before any chart
is promised.

### 2b · Platform post performance — **does not exist**

This is the significant correction. `post_events` (migration 150) is a well-designed
telemetry table: `impression · view · complete · tap_shop · tap_product · share · save ·
unsave · like · unlike · add_to_bag`, with `surface`, feed `position`, `dwell_ms`,
`product_id`, guest-friendly `device_id`.

| Check | Result |
|---|---|
| Ingest endpoint | `POST /v1/follower/events` — **exists** |
| Any read of the table | **Zero** `FROM post_events` in the entire backend |
| Service exports | `validateBatch, ingest, EVENT_TYPES, SURFACES, MAX_BATCH` — **ingest only** |
| Rows in production | **0** |

So the pipe is **neither filled nor drained**. Nothing sends events, and nothing could read
them if it did. "How our platform posts are performing" is not a screen that is missing — it
is a feature that does not exist, on top of a table that was built for it.

Two pieces of work, in order: the follower app must **emit** events, then an aggregate read
API must exist. A creator-facing chart is third, not first.

### 2c · Earnings on this campaign — **account-level only, and the brand has it better**

`GET /influencers/me/earnings` aggregates **across all campaigns**: locked escrow (joined to
campaign name) plus one commission total from `follower_transactions`. `getMyCampaignDetail`
carries **no money fields at all**.

Meanwhile the brand has `GET /brands/me/campaigns/:campaign_id/conversions` — **per
campaign**.

> The brand can see what one campaign earned. The creator cannot see what one collaboration
> paid her. That asymmetry sits in a product whose whole sales track is "you earn when
> someone buys".

The data is there: `follower_transactions` carries all four attribution IDs and holds **6
completed rows** in prod. This is a grouping that was never written, not missing data.

### 2d · Product-level sales — data exists, rollup does not

`follower_transactions` attributes campaign / set / offer / influencer per row. There is no
per-product sales rollup for the creator — "which of the three sarees actually sold" is
answerable from the data and is not answered anywhere.

---

## 3 · Brand search — location

Unchanged from the `creator-collab-conversations` audit, restated because it is the same
question:

- `discoverEligibleBrands` filters on **`users.city` only** — free text, NULL for 10 of 26
  brands, holding **"Vijayawada" (5)** and **"Vijaywada" (1)** as separate values, plus
  **"Tadepalle"**, a locality filed as a city.
- Unread on `brands`: `locality` (12/26 — HITEC City, Jubilee Hills, Indiranagar, Bandra,
  Gachibowli), `pincode` (11), `lat`/`lng` (13), `formatted_address` (7).
- **1 of 26 brands** has `accepts_proposals = TRUE`, and that one is a restaurant with no
  city and no locality.

Answer: the location data exists on the right table and discovery reads the wrong one. Still
blocked behind the `accepts_proposals` decision (options A/B/C) before any of it is visible.

---

## 4 · Products, category-wise — the tree is populated and no endpoint returns it

### The category structure exists

`brand_products` carries `category_key`, `super_category`, `category_node_id`, `tags`.
Production: **92 products · 92 `category_key` · 80 `super_category` · 80 `category_node_id`**.
The tree is real and populated.

### None of the three surfaces returns it

| Scope | Endpoint | Returns | Category-wise? |
|---|---|---|---|
| **Per brand** (while searching) | `browseBrandProducts` | `id, name, price, image_url` — flat, name-search, cap 40 | **No — the category is not even in the payload** |
| **Per campaign** | `getCampaignProducts` | Resolves allocation scope via `ci.alloc_scope`, `alloc_category_node_id`, `alloc_category`, `alloc_product_ids` | Knows category **for scoping**, does not group output by it |
| **Everything she may stock** | `listStockable` | `bp.name, price, image_url, bp.section` + `b.category AS brand_category`, `ORDER BY brand_name, product_name` | **No** — `b.category` is the brand's *vertical* (fashion/restaurant), not the product's category |

**The recurring mistake:** every one of these returns `b.category` — the brand's industry —
and none returns `bp.category_key` / `super_category` / `category_node_id`. A client cannot
group by a field it is never sent. This is a projection fix in three places, not a data
model problem.

`listStockable` does return `bp.section`, which is a grouping of a sort and the nearest
thing to category-wise anywhere in the product surfaces.

---

## 5 · What each side has today

| Capability | Brand | Creator |
|---|---|---|
| Per-campaign conversions | **Yes** | **No** |
| Account-level earnings | Wallet | Yes |
| Social post stats | Via deliverable | Via deliverable — same snapshot |
| Platform post performance | **No** | **No** — table never read, 0 rows |
| Step history | Shoot only | Shoot only |
| Action-required inbox | **Yes** — `BrandActionRequiredScreen`, 5 tabs | **No** — "N need you" is computed with no screen behind it |
| Product catalogue, category-wise | Owns the catalogue | **No** — no endpoint returns product category |
| Brand location in discovery | n/a | Dirty city only; `locality` unread |

---

## 6 · Ordered conclusions

1. **`collab_event_log` before per-step detail screens.** Five of six steps keep no history,
   and the mocked negotiation timeline cannot be built without it. One table, one component,
   six uses.
2. **Per-campaign earnings for the creator** is the cheapest real win here — a `GROUP BY`
   over data that already exists, closing an asymmetry the brand already enjoys.
3. **Product category is a projection fix in three endpoints.** The tree is populated; the
   payloads drop it.
4. **Platform post performance is two jobs, not one screen** — emit events from the follower
   app, then build the read API. Do not promise the chart first.
5. **`deliverable_stats` must become row-per-scrape** before any growth chart is drawn.
6. Brand location and the empty brand directory stay blocked on the `accepts_proposals`
   decision.

Nothing here needs a mockup to decide. Mockups follow once these are agreed.
