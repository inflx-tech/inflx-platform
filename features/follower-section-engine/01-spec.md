# Feature Spec — Follower Section Engine (Phase A: engine foundation)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> This is **Phase A** of the Creator Vibe section-engine program
> (`design/wave4-creator-vibe/IMPLEMENTATION-PLAN.md`). Design is LOCKED
> (`design/wave4-creator-vibe/SECTION-CATALOG.md`, 9 screens, 2026-06-01).
> Phases B/C/C2/D/E/F are their own contracts; this one builds the spine only.

## Problem / goal
Today the follower app's discovery screens (Home, Category, Offers, Creator
Store, Creator's Category) render from **hardcoded layouts + hardcoded slicing**
(e.g. `HomeScreenV2`'s "first 6 = hot"). The locked Creator Vibe design makes
every screen an **admin-controlled list of shelves** ("sections"), each filled
automatically by a ranking rule, reorderable/toggleable/count-adjustable from an
admin Section Manager, publishing instantly with no app update.

Phase A builds the **backend foundation** that makes that possible:
1. a `section_config` table (the spine — one row per shelf),
2. a **ranking rule library** (the SQL behind each shelf),
3. a **feed-endpoint framework** returning `{ sections: [...] }`,
4. **seed defaults** transcribed from the locked catalog.

It builds NO admin UI (Phase B) and NO mobile renderer (Phase C). It is the
data + API contract those phases consume.

## Scope
- **In scope (Phase A):**
  - Migration **083** `section_config` table + indexes + idempotent seed of the
    locked HOME catalog (full 9 shelves) and the default templates for Category /
    Offers / Creator Store / Creator's Category (global scope).
  - Ranking rule library (a `sectionRules` service): `top_by_engagement`,
    `top_by_sales`, `top_by_conversions`, `newest`, `ending_soon`, `near_me`,
    `by_creator`, `follow_graph`, `creators_near`, `creators_in_category`, plus
    static resolvers `nav_verticals` / `filter_controls` for non-data shelves.
  - A `sectionEngine` resolver: load config for a `(screen, scope)` → run each
    enabled shelf's rule in `position` order → assemble `{ sections: [...] }`,
    every actionable item carrying its entity + the 4-ID attribution/tracking
    block (the canonical `/s/{handle}?cid&sid&oid&iid` chain).
  - Five **public** feed endpoints (auth optional for personalization):
    `GET /v1/follower/home`, `/v1/follower/section/category/:key`,
    `/v1/follower/section/offers`, `/v1/follower/section/creator/:handle`,
    `/v1/follower/section/creator/:handle/category/:cat`.
  - Redis caching of rule results with a short TTL (Redis already in stack).
  - API tests: per-rule ranking correctness + 4-ID tracking present + zero
    regression on existing `/feed`, `/home-feed`, `/deals`, `/stories`.
- **Explicitly out of scope (later phases / deferred):**
  - Admin endpoints + admin-web Section Manager UI → **Phase B**.
  - Mobile `<SectionRenderer>` + wiring any screen → **Phase C / C2**.
  - Business Page / Product Detail block templates → **Phase D**.
  - Orders `/activity` aggregator + Profile wiring → **Phase E**.
  - Reels shelves everywhere → **Flow 52.8** (`features/follower-shoppable-reels`,
    migration 081, deferred).
  - City/vertical **override** rows (admin-authored) — Phase A seeds GLOBAL
    defaults only; the resolver supports the override-merge, Phase B authors them.
  - Creator **discount-code** field (catalog Product block 8) — needs new data,
    deferred.

## Surfaces touched
- App(s): **backend only** (`backend/migrations/**`, `backend/src/**`,
  `backend/scripts/run-083.js`). No mobile, no web in Phase A.
- Roles involved: **follower** (consumes feeds; public + optional-auth for
  personalization). No admin surface in this phase.

## Data / contracts

### New table — `section_config` (migration 083)
One row per shelf. Repeatable "Top in {category}" rails are distinct rows
distinguished by `category_key` + `item_type`.

```sql
CREATE TABLE IF NOT EXISTS section_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen       text NOT NULL
               CHECK (screen IN ('home','category','offers',
                                 'creator_store','creator_category')),
  scope_type   text NOT NULL DEFAULT 'global'
               CHECK (scope_type IN ('global','city','vertical')),
  scope_value  text,                 -- NULL for global; city name; or vertical key
  shelf_key    text NOT NULL,        -- logical shelf id, e.g. 'stories','whats_hot','top_in'
  title        text NOT NULL,        -- display template, may contain {city}/{category}/{creator}
  shelf_type   text NOT NULL
               CHECK (shelf_type IN ('creators','nav_tiles','offers','products',
                                     'brands','mixed','controls')),
  rule         text NOT NULL,        -- rule-library key, or 'static' for nav/controls
  item_type    text                  -- 'brands'|'products'|'offers' for repeatable rails
               CHECK (item_type IS NULL OR item_type IN ('brands','products','offers')),
  category_key text,                 -- vertical key for "Top in {category}" rails
  item_limit   int  NOT NULL DEFAULT 8,
  position     int  NOT NULL,        -- order within (screen, scope_type, scope_value)
  enabled      boolean NOT NULL DEFAULT true,
  pinned_ref   uuid,                 -- e.g. Offers hero PIN (a campaign_offers.id)
  config_json  jsonb,               -- chips list / filter list / sub-sort / extensibility
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed idempotency + the "one shelf instance per scope" identity.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_section_instance
  ON section_config (screen, scope_type, COALESCE(scope_value,''),
                     shelf_key, COALESCE(category_key,''), COALESCE(item_type,''));

CREATE INDEX IF NOT EXISTS idx_section_screen_scope
  ON section_config (screen, scope_type, scope_value, position)
  WHERE enabled = true;
```
Additive · idempotent · forward-only (per migration convention). **Dormant on
deploy**: with the seed present but no endpoint wired into the mobile app yet
(Phase C), nothing in production renders from this table — the existing hardcoded
screens keep serving until each is flipped behind a feature flag.

### Scope resolution
`scope_type='global'` rows are the base. `city`/`vertical` rows (Phase B) override
a global row **by `shelf_key` (+ category_key/item_type)** when present for the
requested city/vertical, else the global row stands. Phase A seeds global only.

### Ranking rule library — data sources (VERIFIED against schema)
A "live offer" = `campaign_offers co` (`co.is_active=true`) → `campaign_sets cs`
→ `campaign_influencers ci` (`ci.status IN ('contracted','active','completed')`)
→ `campaigns c` (`c.status IN ('published','active','live')`), the canonical chain
already used in `follower.service.js`. City = `users.city` via `brand → users`.

| Rule | Fills | Data source (verified) | Status |
|---|---|---|---|
| `follow_graph` | offers/creators from followed creators | `follows` + live-offer chain | ✅ buildable |
| `creators_near` | active creators in city | `influencers` + `users.city` + `follows` | ✅ |
| `creators_in_category` | creators active in a vertical+city | `influencers` × listing category | ⚠️ ranking query |
| `nav_verticals` | the 7 verticals | static (CATEGORY_MAP) | ✅ |
| `ending_soon` | offers expiring soonest | **`campaign_influencers.offer_expires_at`** (NOT on campaign_offers) | ✅ (join) |
| `newest` | newly-listed | `campaign_influencers.created_at` / brand `created_at` — **`campaign_offers` has NO `created_at`** | ⚠️ anchor choice |
| `top_by_engagement` | top brands/offers by clicks+conversions | `link_clicks.clicked_at` + `follower_transactions` (7d, city) | ⚠️ ranking query |
| `top_by_conversions` | top offers by conversions | `follower_transactions` grouped by `offer_id` | ⚠️ ranking query |
| `top_by_sales` | top products | `follower_transactions` — **carries `offer_id`, not product_id**; product-level sales attribution must resolve product via offer/`products_json` | ⚠️❓ needs design |
| `by_creator` | offers grouped under each creator | live-offer chain grouped by `influencer_id` | ⚠️ grouping query |
| `near_me` | sort by distance | `attachDistance` util + follower lat/lng (already exists) | ✅ |
| biggest discount (via `top_by_conversions` cfg or own rule) | highest % off | `campaign_offers.discount_value` | ✅ |

> **Backend-first honesty:** `campaign_offers` has columns `discount_value,
> offer_type, products_json, availing_modes, bundle_price, volume_threshold,
> prebook_advance, is_active` — and **no** `city`, `vertical`, `created_at`, or
> `expires_at`. City comes from the brand's `users.city`; vertical from the
> listing/category schema (`CATEGORY_MAP` in `follower.service.js`); expiry from
> `campaign_influencers.offer_expires_at` (migration 016 = posting_date). Every
> ⚠️/❓ above is a query-design task in Phase A, NOT new data. `top_by_sales`
> product attribution is the one genuine open question (flagged for the lock).

### New API endpoints
All public, `authenticateOptional` (city + personalization from JWT when present,
else `?city=` query like the existing feeds). Standard envelope `{success,data}`.

| Method + path | Returns |
|---|---|
| `GET /v1/follower/home?city=` | `{ sections:[ … ] }` for screen=home |
| `GET /v1/follower/section/category/:key?city=` | screen=category, scope vertical=:key |
| `GET /v1/follower/section/offers?city=&sort=&chip=&group=` | screen=offers (hero+rails / grid / by-creator) |
| `GET /v1/follower/section/creator/:handle` | screen=creator_store, that creator's data |
| `GET /v1/follower/section/creator/:handle/category/:cat` | screen=creator_category |

**Section payload shape** (the contract Phase C's renderer consumes):
```json
{ "sections": [
  { "key": "whats_hot", "title": "What's Hot in Vijayawada", "type": "offers",
    "item_type": "offers", "items": [
      { "entity_type": "offer", "id": "…", "title": "…", "brand": "…",
        "discount": "20% OFF", "via_creator": { "handle": "@MamaPizza", "avatar": "…" },
        "tracking": { "cid": "…", "sid": "…", "oid": "…", "iid": "…",
                      "url": "inflx.in/s/MamaPizza?cid=…&sid=…&oid=…&iid=…" } }
    ] }
] }
```
`tracking` is built from the offer's resolved campaign/set/offer/influencer IDs —
the same 4-ID chain share links use; no change to `follower_transactions`.

### Money/units, attribution, status machines
- Money: rupees throughout (no paise in feeds). Discounts as `discount_value`
  (numeric) + display string.
- Attribution: 4-ID tracking block on every actionable item (no new columns).
- Status machines: none changed — read-only over existing offer/txn/click data.

## Non-functional
- **Auth/role gates:** public read; `authenticateOptional` adds the follower's
  city + follow-graph personalization when a follower JWT is present. No admin
  surface in Phase A.
- **Performance:** each rule query is indexed and Redis-cached (short TTL per
  `(screen, scope, rule, params)`). Hot-shelf precompute via cron deferred to a
  fast-follow only if needed (risk noted in the plan).
- **Failure modes the feature must handle:** missing city (fall back to global,
  un-cityed ranking) · empty shelf (omit or return empty `items`, never 500) ·
  rule with insufficient data (degrade gracefully, log) · cache miss (compute
  live) · unknown `:key`/`:handle`/`:cat` → `NOT_FOUND`.
