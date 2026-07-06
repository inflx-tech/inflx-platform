# Phase 0 — Section-engine correctness + App Builder guardrails

**Program:** Section-rules admin-control program, Phase 0 (locked in chat 2026-07-05).
**Founder go:** "start phase 0" — 2026-07-05 (lock delegated under standing autonomy).

## Problem

Four defects/foot-guns found during the 2026-07-05 section-system deep-dive:

- **A1 — Business page shows other brands' offers.** The Deals-shelf rules
  (legacy `OFFER_FROM` SQL and the V2 `brandOffers.adapter` path) never
  consult `ctx.brandId`, so a brand's own page (`screen='business'`) renders
  the global offer pool.
- **A2 — Un-pushed products linger on creator surfaces.** The allocation
  path deliberately skipped `pushed_to_store`; but the publish flow is
  list → push → allocate, so un-pushing must also pull the product from
  creator stores. Affected: `resolveStore` (follower + creator preview) and
  `libraryProducts` creator-scoped branch.
- **B1 — "Category browser" tap action cannot be completed in the UI.**
  Both the wizard `destPicker` and the inline editor offer `type=category`
  but only a *world* select — `category_node_id` (required by
  `validateTapDestination`) has no input anywhere, so Publish always 422s:
  `config_json.tap_destination.category_node_id required for type=category`.
- **B2 — No schedule guardrail.** A "Disappears" time in the past (or
  minutes away) publishes silently and the section never shows / vanishes
  immediately — the founder hit exactly this ("Live until Jul 5, 11:07 AM").

## Scope

- Backend: brand-scope all offer rules when `ctx.brandId` is set (legacy
  7 deals rules + `topPicks`; V2 `rankForRule` + `offersViaAdapter`).
- Backend: require `pushed_to_store = true` on allocated-product reads
  (`resolveStore`, creator preview twin, `libraryProducts`).
- Admin UI: `CategoryNodePicker` (self-fetching, cached per world) wired
  into the wizard destPicker, inline "Which category?", and per-tile
  destination; vertical change clears the stale node id.
- Admin UI: `scheduleWarning` (past end = red/blocking in wizard; <6 h =
  amber heads-up) in wizard step 3 + inline schedule box; `tapDestinationProblem`
  pre-check blocks wizard finish (step 4) and Publish with plain-language
  messages instead of backend 422s.

## Out of scope (later phases)

Layer-2 rule-control UI (window_days etc.), banner hide-when-empty,
per-world World Rules settings, live whole-store allocation, checkout
coupon-eligibility (left untouched deliberately — placeOrder re-prices
authoritatively).
