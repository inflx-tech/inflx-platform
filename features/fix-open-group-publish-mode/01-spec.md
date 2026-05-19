# Feature Spec — fix open-group publish mode mismatch

> Step 1. Implementation GATED on `lock.json.approved = true`.
> PRODUCTION-IMPACTING (backend runtime → Render). Resolves the
> carved defect `features/backend-defect-open-group-publish-
> assignment-mode-mismatch` (founder GO 2026-05-19: "if really
> broken fix it" — confirmed broken).

## Problem
`POST /v1/campaigns/:id/sets/:sid/publish-open` always returns
422 — open-group campaign publishing is non-functional. Root
cause (verify-twice, P11 + this phase): `campaign_sets` has two
mode columns — `assignment_mode` ENUM (migrations/001:221, never
written by the API → NULL) and `influencer_mode` varchar
(migrations/002:12). `createSet` writes **`influencer_mode`**
(campaign.controller.js:480-489) and ALL open-group logic reads
`influencer_mode` (campaign.controller.js:66, :1300, :1435 — the
canonical column). Only `publishOpenGroup`
(offer.controller.js:835,838) reads the stale
`set.assignment_mode` → always NULL ≠ 'open_group' → always 422.

## Fix (minimal, behaviour-preserving)
`offer.controller.js:835,838`: `set.assignment_mode` →
`set.influencer_mode` (the canonical column, consistent with
every other open-group reader). 2-line controller change. No
migration, no backfill (influencer_mode is already populated).

## Success
`pnpm qa:db`: `tests/negotiations.test.js` `'publishes the
open-group set and returns 200'` flips RED→GREEN **by the
backend fix** (not a test edit). Sibling `'returns 422 when set
is not open_group'` stays GREEN (a handpick set still 422s —
now for the correct reason). Main `pnpm qa` 66/C1/gate-0
unchanged. No new genuine 500s.

## Surfaces / deploy
- `backend/src/controllers/offer.controller.js` (governed path).
- **PRODUCTION-IMPACTING**: `git push origin main` → Render
  auto-deploys the backend. Surfaced explicitly; founder GO on
  record. Forward-only; rollback = revert the 2-line change.
