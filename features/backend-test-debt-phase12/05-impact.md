# Impact Analysis — backend-test-debt Phase 12

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/**` (Jest — not in the running
  server import graph) + this contract. No `src`/migration/
  runtime change → no Render/Vercel. No new carve (every
  behaviour verified intentional; 4 prior carves untouched).
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Pre-release: honest delta +
  no-fake-green + main `pnpm qa` 66/C1/gate-0 unchanged +
  gov-check clean.

## Affected files
- **Change:** `backend/tests/` campaigns, earnings, contracts,
  brand, influencer, follower-feed, engagement test files —
  per-item class-2/4 alignments (each cited).
- **Read (authoritative):** wallet.controller.js (getWallet
  :68-74, createTopup :104); escrow.service.js:115;
  brand.controller.js:102-135; influencer.controller.js:196-205;
  follower.controller.js:55-60 (follower register writes
  users.city — disproves the suspected city defect);
  contract.controller.js:504-530; follower.service.js
  ACTIVE_CI_QUERY:73-108 + getFeed:560; engagement.service.js
  :151-163.
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `governance-check.mjs`, the 4
  carved `features/backend-defect-*` (their tests stay RED).

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only Jest test files + features/ docs). `backend/tests/**`
  is NOT a GOVERNED path → gov-check triggers no
  contract-approval gate (deploy-inert).
- DB lane: the measured surface; deterministic. `setupFeed
  Scenario` is shared by the follower-feed describe; the
  +formats_json fix is contract-required for all its consumers;
  re-measure delta is exact. The passing sibling wallet test
  (campaigns.test.js:764, different response context) is NOT
  touched.

## Risk notes
1. **Engagement re-point** — re-pointing from removed
   `category_benchmark_er`/`daily_reach` to the real
   `total_likes/…/avg_er` + by_set/by_influencer asserts the
   evolved contract (engagement.service.js:151-163), not a
   weaker test. If product intends a category benchmark it's a
   future feature, not a backend defect — recorded as an
   observation, not silently masked.
2. **No class-3 missed** — every item traced to a deliberate
   controller/service/schema line; the one suspected defect
   (follower city) was DISPROVEN by verify-twice (follower
   register writes users.city). If the re-measure contradicts a
   class-2 call → carve, never force.
3. **Final-state honesty** — the report states the true split:
   the full P1-P12 fixed count vs the 4 genuine carved defects
   that remain (now visible/tracked, not hidden in a red
   number) — the intended ladder end-state.

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city)→146(P4)→123(P5)→82(P6)→
49(P7)→39(P8)→29(P9)→23(P10)→14(P11)→Phase 12. Related:
`features/backend-test-debt*`, `features/qa-db-determinism`,
`features/qa-db-truncate-flake`, `features/qa-aggregation-
fidelity` (C1), `features/backend-defect-*` (carved:
city-column [FIXED]; follower-feed-noauth-500,
onboarded-creator-city-search,
search-includes-pending-influencers,
open-group-publish-assignment-mode-mismatch [4 open RED]).
