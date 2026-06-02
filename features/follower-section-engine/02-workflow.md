# Workflow — Follower Section Engine (Phase A)

> Step 3. The build sequence + the end-state the QA must prove. No code
> until `lock.json.approved=true` (Step-5 lock; founder-delegated decision).

## Build sequence (after lock)
1. **Migration 083** `section_config` — table + `uniq_section_instance` +
   `idx_section_screen_scope` + idempotent seed (HOME full 9 shelves global;
   Category/Offers/Creator-Store/Creator-Category default templates global).
   `ON CONFLICT (uniq_section_instance) DO NOTHING`. Forward-only, additive.
2. **Runner** `backend/scripts/run-083.js` (per `run-082.js` precedent: dotenv,
   ssl-mode autodetect, run SQL, sanity-assert table + seed row count, `console.table`).
   Run against LOCAL dev first (`.env`); prod (`.env.prod-backup`) only at the
   explicit prod-go.
3. **Rule library** `backend/src/services/sectionRules.service.js` — one resolver
   per rule key, each returning ranked `[{entity…}]`; reuse the canonical
   live-offer chain + `attachDistance` + `CATEGORY_MAP` from `follower.service.js`
   (do not duplicate). Redis cache wrapper per `(rule, params)`.
4. **Engine resolver** `backend/src/services/sectionEngine.service.js` — load
   `section_config` for `(screen, scope)`, apply global→city/vertical override
   merge, run each enabled shelf's rule in `position` order, attach the 4-ID
   tracking block to every item, assemble `{ sections: [...] }`.
5. **Controller + routes** — 5 endpoints in `follower.controller.js` /
   `follower.routes.js` (`authenticateOptional`), mirroring the existing feed
   handlers' city-resolution pattern (`follower?.user_city || req.query.city`).
6. **API tests** under `backend/tests/` (Jest, per existing follower tests) +
   `qa/+features/` contract entries: per-rule ranking + 4-ID tracking presence +
   envelope shape + graceful-empty + zero-regression on existing feeds.

## Verification (the gate)
- `pnpm qa` — web Playwright suite stays **GREEN** (zero regression). Phase A is
  backend-only, so the proof is "existing flows unaffected".
- `pnpm qa:db` — migration lane (informational; run once on a fresh boot per the
  host-ceiling discipline) confirming 083 applies idempotently + seed lands.
- **Backend API tests** — the new section endpoints return correctly-ranked,
  4-ID-tracked sections; each rule asserted.
- No `pnpm qa:maestro` needed in Phase A (no mobile change; Maestro gate applies
  when a Mobile commit flips `released=true`, which is Phase C).

## End state proven by QA
- `section_config` exists with the seeded HOME shelves (and template rows) at
  global scope.
- `GET /v1/follower/home?city=Vijayawada` returns the locked HOME shelves in
  order, each populated by its rule, each item carrying 4-ID tracking — matching
  `home-comprehensive.html`'s shelf list.
- The other four section endpoints return their seeded shelves.
- Existing `/feed`, `/home-feed`, `/deals`, `/stories` behave identically
  (regression-free) — the engine is **additive and dormant** until Phase C wires
  the mobile app.

## Release classification
- The contract docs + mockups (this commit) = **deploy-inert** (`features/**`,
  `design/**`) — commit/push freely.
- Migration 083 + `backend/src/**` + runner = **production-impacting** (Render
  redeploys; runner mutates the prod DB when pointed at `.env.prod-backup`).
  Built + verified locally, then **surfaced for explicit founder go** before any
  push/prod-run. Dormant-on-deploy (no mobile consumer yet) lowers risk but does
  not waive the explicit go.
