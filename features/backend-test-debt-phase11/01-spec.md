# Feature Spec — backend-test-debt Phase 11

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-10 ladder on the now-DETERMINISTIC qa:db instrument.
> Baseline (post-P10, 899296f): **359 passed / 23 failed / 382**.

## Problem / goal
P10 cleared the influencer-search shape cluster (29→23). Phase
11 takes the **campaigns publish / set-CRUD cluster** — 10
failing tests (campaigns.test.js ×7 + negotiations.test.js
publish-open ×3). Root cause was previously unpinned; this
phase pinned it conclusively via controller verify-twice (every
failure maps to a cited controller line — no instrumentation
needed, the code is unambiguous). All **class-2/4 stale
fixtures vs evolved campaign-lifecycle contracts; backend
VERIFIED CORRECT; NO class-3 carve** (every behaviour is
deliberate/documented in code):

- `POST /v1/campaigns` route is now `brandApproved`
  (`campaign.routes.js:12` → `requireApproved`). The
  `'returns 404 when brand profile not registered'` test uses
  an un-approved brand → middleware **403** before the
  controller's `NOT_FOUND 404` (`campaign.controller.js:20`).
- Campaign-create requires `start_date`/`end_date`
  (`campaign.controller.js:190-193`). The `'no total_budget'`
  test posts only `{name}` → 422 before publish.
- **Publish requires ≥1 set** (`campaign.controller.js:900`
  `'Campaign must have at least one set before publishing'`).
  `fundedBrandWithCampaign` creates none → the 4 publish tests
  fail / mis-code (the no-set 422 fires before the wallet
  check, so `WALLET_INSUFFICIENT` arrives as `VALIDATION_ERROR`).
- **Publish moves NO money and sets status `'active'`**
  (`campaign.controller.js:942-974,1031`; comment: funds stay
  in wallet, lock per-influencer at brand-sign; status→active,
  no `escrow_lock` wallet_transaction at publish). Tests #1/#4
  assert the OLD publish-debits-wallet / status `'published'` /
  escrow_lock-at-publish behaviour → class-2 business-rule
  drift.
- `deleteSet` blocks removing the **last** set
  (`campaign.controller.js:550` `<=1` → 422). The DELETE-set
  test creates 1 set then deletes it.
- `updateSet` allows `set_budget`, not `budget`
  (`campaign.controller.js:512`); response is the
  `campaign_sets` row (column `set_budget`). The PATCH-set test
  sends `budget` and asserts `set.budget` → NaN.
- `negotiations.test.js setupOpenGroupScenario` set-create
  omits `set_budget` for an engagement set
  (`campaign.controller.js:452` requires it) → 422 cascade;
  `'422 not open_group'` skips `approveUser` → `requireApproved`
  403.

## Scope (Phase 11 — one measured, evidence-driven batch)
~10 failing tests, all class-2/4, backend VERIFIED CORRECT,
**NO carve**:
1. **Lever — campaign-lifecycle fixture alignment:**
   - 404-test: approve the brand user (don't register) → reach
     the controller's `NOT_FOUND 404`.
   - `fundedBrandWithCampaign`: create an engagement set so
     publish passes the ≥1-set gate.
   - publish #1: assert verified contract — status `'active'`,
     `published_at` defined, wallet **not** debited (stays =
     budget; publish moves no money).
   - publish #2 (WALLET_INSUFFICIENT): add an engagement set so
     the wallet check is reached → `WALLET_INSUFFICIENT`.
   - publish #3 (no total_budget): send `start_date`/`end_date`
     (omit `total_budget`) + an engagement set → publish 422.
   - publish #4 (escrow_lock): align to the verified
     post-publish contract — publish → active, **no**
     `escrow_lock` txn at publish (escrow locks at brand-sign).
   - PATCH-set: send `set_budget`; assert `set.set_budget`.
   - DELETE-set: create a 2nd set before deleting (≥1 must
     remain).
   - negotiations `setupOpenGroupScenario`: add `set_budget` to
     the open_group engagement set-create.
   - negotiations `'422 not open_group'`: add `approveUser`.
2. CARVE genuine class-3 RED — **NONE** (every behaviour
   verified intentional/documented in the controller; the
   fixtures are stale, not the backend). Confirm no new 500s
   beyond the carved follower-feed-noauth-500.
3. Re-measure honestly vs 359/23; main `pnpm qa` 66/C1/gate-0
   unchanged.

## Out of scope / forbidden
- NOT zero; one measured batch. Remaining: follower-feed
  feed-empty ×3, register-422 ×2, engagement ×1, the P8
  reclassified-out items (payout-id-format, set/wallet
  response-shape, topup-boundary), + the 3 open carved-RED
  defects → Phase 12+.
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Each aligned value/step is the verified current
  contract (cited controller line), not reverse-engineered.
  Publish #1/#4 assert the deliberate evolved behaviour (no
  money at publish; status active) — documenting the real
  contract, NOT masking.
- No backend/runtime change.

## Surfaces touched
- `backend/tests/campaigns.test.js` +
  `backend/tests/negotiations.test.js` + this contract.
- **Deploy-inert** (tests not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = classification grounded in the cited controllers +
  honest measured delta on the deterministic instrument + zero
  class-3 missed (any behaviour that turns out genuinely wrong
  → carve RED, not align) + zero main-lane regression. Big
  delta via masking = FAILURE.
