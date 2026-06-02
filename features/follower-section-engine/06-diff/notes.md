# 06-diff — Follower Section Engine (Phase A)

> Phase A is **backend-only** (no `Packages/*/(src|...)` change), so gov-check
> Rules 3/4 (mockup-lock, before/after-diff) do NOT gate this commit. These notes
> are kept for honesty + to hand Phase C a clear "what the API now returns".
> The visual before/after diff belongs to Phase C (mobile renderer vs mockups).

## What shipped (backend)
- Migration **083** `section_config` + `uniq_section_instance` + `idx_section_screen_scope`,
  seeded with the LOCKED catalog defaults at GLOBAL scope (Home 12 shelves incl.
  4 "Top in" rails; Category/Offers/Creator-Store/Creator-Category templates).
- Runner `scripts/run-083.js` (run-082 precedent; sanity-asserts seed per screen).
- `utils/tracking.js` — `buildTracking()` 4-ID `/s/{handle}` attribution block.
- `utils/ttlCache.js` — in-process TTL cache (see "Deviations" — Redis not in stack).
- `services/sectionRules.service.js` — ranking rule library (reuses the canonical
  live-offer joins from follower.service).
- `services/sectionEngine.service.js` — config→rules→`{sections}` resolver with
  global/override merge + title interpolation.
- 5 public endpoints on `follower.routes` (`/home`, `/section/category/:key`,
  `/section/offers`, `/section/creator/:handle`, `/section/creator/:handle/category/:cat`).
- `tests/section-engine.test.js` — ranking, 4-ID tracking, disabled-shelf omission,
  unknown-creator 404, regression.

## Matches the locked design (SECTION-CATALOG.md)
- Home shelf set + default counts + "New This Week" off + the 3 Eat rails
  (Brands/Products/Offers) + Shop Brands rail — exactly as the Home Section
  Manager mockup shows.
- Every offer/brand item surfaced via a creator carries the `via @creator`
  attribution (the mockup's `.vc`/`.by` chips) as a real 4-ID tracking block.

## Honest divergences / deviations (verify-twice findings)
1. **Migration number 083, not 082** — the brief estimated ~082; reality: 081
   (reels, uncommitted) + 082 (meals, run) were already taken.
2. **Redis NOT in the stack** — the plan assumed "Redis already in stack"; there
   is no redis/ioredis dependency or client in `backend/src`. Phase A uses an
   in-process TTL cache behind a swappable interface rather than provisioning new
   prod infra in a foundation phase. Per-process + cleared on restart (documented
   in `utils/ttlCache.js`); swap to Redis later without touching the rule library.
3. **`top_by_sales` product rails seeded `enabled=false`** (founder-delegated) —
   `follower_transactions` carries `offer_id`, not `product_id`; no fabricated
   product ranking ships. Re-enable in a fast-follow once product→offer resolution
   is designed.
4. **City = soft boost, not hard filter** — mirrors existing getHomeFeed/getDeals
   behavior so "in {city}" shelves stay populated when a city has thin inventory.
5. **Offer expiry** ranks via `campaign_influencers.offer_expires_at` (migration
   016 = posting_date), not a column on `campaign_offers`.

## Not done in Phase A (by design — later contracts)
Admin Section Manager (B) · mobile SectionRenderer + screen wiring (C/C2) ·
detail-screen block templates (D) · Orders/Profile (E) · Reels shelves (52.8).
Production screens are unchanged until Phase C flips each behind a feature flag.
