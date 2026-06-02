# Impact — Follower Section Engine (Phase A)

## One-line verdict
**Additive backend spine, dormant on deploy.** A new table + read-only ranking
endpoints; nothing in production renders from it until Phase C wires the mobile
app behind a feature flag. Zero functional disturbance to existing flows.

## Release classification
- This contract commit (docs + mirrored mockups): **deploy-inert**.
- The implementation commit (migration 083 + `backend/src/**` + runner):
  **production-impacting** — Render redeploys the backend and `run-083.js`
  mutates the DB. Surfaced for **explicit founder go**; never silent.

## What changes
- **DB:** one new table `section_config` (+ 2 indexes) + idempotent seed rows.
  No change to any existing table, column, or constraint. No data migration.
- **Backend:** 2 new services (`sectionRules`, `sectionEngine`), 5 new public
  routes, ~6 new controller handlers. No existing handler modified beyond adding
  routes to `follower.routes.js`.
- **No** mobile, web, money-path, attribution-table, or status-machine change.

## What is NOT disturbed (verify-twice grounded)
- Existing follower feeds `/feed`, `/home-feed`, `/deals`, `/stories`,
  `/categories`, `/search` — untouched; the new endpoints sit alongside.
- `follower_transactions` and the 4-ID attribution chain — read-only; no schema
  or write-path change. Tracking blocks are computed from existing IDs.
- Brand-web / admin-web / mobile-brand / mobile-influencer — not touched
  (follower-scoped, and no mobile change at all in Phase A).
- The shipped Flow 52 recolor and the deferred reels migration 081 — independent.

## Risks + mitigations
- **Ranking-query performance** → indexed + Redis-cached short TTL; cron
  precompute deferred unless measured slow.
- **Config-schema correctness** (the spine — a later change ripples) → schema
  locked here with the catalog as the seed; `config_json` jsonb absorbs
  additive extension without a migration.
- **`top_by_sales` product attribution** → genuine open question
  (`follower_transactions` carries `offer_id`, not `product_id`); if unresolved
  at lock, product rails ship **disabled** (no fabricated data).
- **Cutover safety** → not a Phase A concern (dormant); Phase C feature-flags
  each screen old↔new and keeps the hardcoded path until proven.

## Parallel-window note (git hygiene)
Window B shares this working tree (agency-role WIP). Phase A touches **only**:
`features/follower-section-engine/**`, `design/wave4-creator-vibe/**` (read),
`backend/migrations/083_*.sql`, `backend/scripts/run-083.js`,
`backend/src/services/section*.service.js`, `backend/src/controllers/follower.controller.js`,
`backend/src/routes/follower.routes.js`, `backend/tests/section*`. **Stage these
paths explicitly — never `git add -A`.** Phase A produces no OTA (backend-only),
so the publish-ota working-tree-bundling caveat does not arise this phase.
