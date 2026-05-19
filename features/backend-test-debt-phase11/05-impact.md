# Impact Analysis — backend-test-debt Phase 11

## Deploy posture — DEPLOY-INERT
- Changes only `backend/tests/campaigns.test.js` +
  `backend/tests/negotiations.test.js` (Jest — not in the
  running server import graph) + this contract. No
  `src`/migration/runtime change → no Render/Vercel. No carve
  (every behaviour verified intentional).
- Step-14 = deploy-inert commit/push; no production approval
  gate (GOVERNANCE.md §5/§7). Pre-release: honest delta +
  no-fake-green + main `pnpm qa` 66/C1/gate-0 unchanged +
  gov-check clean.

## Affected files
- **Change:** `backend/tests/campaigns.test.js` (404-test,
  `fundedBrandWithCampaign`, publish ×4, PATCH-set, DELETE-set)
  + `backend/tests/negotiations.test.js`
  (`setupOpenGroupScenario`, `'422 not open_group'`).
- **Read (authoritative):** `campaign.routes.js:8-12`
  (brandAuth/brandApproved); `campaign.controller.js`
  create(:20,:187-196), updateSet(:506-538), deleteSet
  (:540-556), createSet(:442-474), publishCampaign
  (:888-1031).
- **Read-only (must NOT change):** `src/**`, migrations,
  `qa/scripts/*`, C1 spec, `governance-check.mjs`.

## Affected workflows (regression surface)
- Main `pnpm qa` (66) + C1 + B2b substrate: must stay identical
  (only 2 Jest test files + features/ docs). `backend/tests/**`
  is NOT a GOVERNED path → gov-check triggers no
  contract-approval gate (deploy-inert).
- DB lane: the measured surface; deterministic. Shared helpers
  `fundedBrandWithCampaign` (publish describe) and
  `setupOpenGroupScenario` (negotiations) feed multiple tests —
  adding a set / set_budget is contract-required for ALL their
  consumers (sibling tests like `'already published'` also need
  a set to publish); the re-measure delta is exact and isolated
  to the 2 files.

## Risk notes
1. **Mis-aligning publish #1/#4** — they assert evolved
   behaviour (no money at publish; status 'active'; escrow at
   brand-sign). Mitigation: aligned strictly to the cited
   controller (`:942-974,:1031`), asserting the deliberate
   documented contract — not a number/string picked to turn
   red green. If the deterministic re-measure contradicts,
   reclassify → carve, honestly (P6 self-correction precedent).
2. **Shared-helper blast radius** — `fundedBrandWithCampaign`
   adding a set must not break `'returns 422 when campaign is
   already published'` (it needs the campaign to publish, which
   now requires a set — so the set ADD is required for it too).
   Deterministic re-measure is the arbiter.
3. **No class-3 missed** — every behaviour traced to a
   deliberate controller line/comment; if any aligned test
   stays RED for a non-fixture reason → carve, never force.
4. **Diminishing returns** — one measured batch; the remaining
   small clusters re-baseline for Phase 12 (bounded, P1-P10
   ledger discipline).

## Ledger
281→244(P1)→231(P2)→194(P3)→192(city)→146(P4)→123(P5)→82(P6)→
49(P7)→39(P8)→29(P9)→23(P10)→Phase 11. Related:
`features/backend-test-debt*`, `features/qa-db-determinism`,
`features/qa-db-truncate-flake`, `features/qa-aggregation-
fidelity` (C1), `features/backend-defect-*` (carved:
city-column [FIXED], follower-feed-noauth-500 [open RED],
onboarded-creator-city-search [open RED],
search-includes-pending-influencers [open RED]).
