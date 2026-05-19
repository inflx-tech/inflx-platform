# Impact Analysis — backend-test-debt Phase 10

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/influencer-search.test.js` (Jest —
  not in the running server import graph) + the new carve folder
  `features/backend-defect-onboarded-creator-city-search/` + this
  contract. No `src`/migration/runtime change → no Render/Vercel.
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Pre-release: honest delta +
  genuine city defect carved RED (not masked) + no-fake-green +
  main `pnpm qa` 66/C1/gate-0 unchanged + gov-check clean.

## Affected files
- **Change:** `backend/tests/influencer-search.test.js` only —
  `data.influencers`→`data.creators` (uniform), assertion
  `…creators[0].instagram_handle`→`…creators[0].ig_handle`,
  `inf.engagement_rate`→`inf.view_based_er`. Register payload
  key untouched.
- **New:** `features/backend-defect-onboarded-creator-city-
  search/` (carve: spec + impact + lock; test LEFT RED).
- **Read (authoritative):** the search controller
  `influencer.controller.js:411-529` (query filters, `success(
  { creators }, 200, {page,limit,total})`); the
  `v_searchable_creators` view migration (onboarded branch
  `i.city`); `influencer.controller.js:214-219` (registration
  writes `users.city`); reverted P10 instrumented diagnostic.
- **Read-only (must NOT change):** `src/**`, migrations, the
  view, `qa/scripts/*`, C1 spec, `governance-check.mjs`.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only one Jest test file + features/ docs). `backend/tests/**`
  is NOT a GOVERNED path → gov-check triggers no
  contract-approval gate (deploy-inert).
- DB lane: the measured surface; deterministic. The single test
  file has NO shared-setup blast radius. The re-measure delta is
  exact: ~7 go green, the city test stays RED on the carved
  defect, zero regression expected.

## Risk notes
1. **Masking the genuine city defect** — gravest risk.
   Mitigation: the city test is carved + LEFT RED; the uniform
   shape-rename makes it fail on the real `creators.length`
   assertion (exposes the bug) rather than a stale TypeError;
   no assertion weakened, backend untouched. It is a carve, not
   a mask.
2. **Asserting a non-real field** — every rename is the field
   observed in the instrumented real response (creators /
   ig_handle / view_based_er), not reverse-engineered from red.
3. **`'does NOT include pending'` uncertainty** — its post-
   rename pass/fail depends on whether the view excludes the
   unapproved onboarded influencer; decided by the deterministic
   re-measure, classified honestly, never forced.
4. **Diminishing returns** — one measured batch; remaining
   clusters re-baseline for Phase 11 (bounded, P1-P9 ledger).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city)→146(P4)→123(P5)→82(P6)→
49(P7)→39(P8)→29(P9)→Phase 10. Related:
`features/backend-test-debt*`, `features/qa-db-determinism`,
`features/qa-db-truncate-flake`, `features/qa-aggregation-
fidelity` (C1), `features/backend-defect-*` (carved:
city-column [brand, FIXED], follower-feed-noauth-500 [open RED],
onboarded-creator-city-search [open RED — new this phase]).
