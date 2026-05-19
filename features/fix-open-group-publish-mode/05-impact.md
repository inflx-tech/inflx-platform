# Impact Analysis — fix open-group publish mode mismatch

## Deploy posture — PRODUCTION-IMPACTING
- Changes `backend/src/controllers/offer.controller.js`
  (GOVERNED path). `git push origin main` → Render auto-deploys
  the backend. Surfaced explicitly; founder GO on record
  (2026-05-19). NOT silent.
- Forward-only. Rollback = revert the 2-line change (no schema
  / data migration involved).

## Affected
- `offer.controller.js publishOpenGroup` (lines 835, 838) —
  read `set.influencer_mode` instead of `set.assignment_mode`.
- Catching test: `tests/negotiations.test.js 'publishes the
  open-group set and returns 200'` (RED→GREEN by this fix).
- Resolves carve `features/backend-defect-open-group-publish-
  assignment-mode-mismatch`.

## Regression surface
- `'returns 422 when set is not open_group'` must stay GREEN
  (handpick set → 422 still correct).
- All other open-group readers already use `influencer_mode`
  (campaign.controller.js:66,1300,1435) — this aligns
  `publishOpenGroup` with them; no behavioural divergence
  introduced. No migration → no DB risk.
- Main `pnpm qa` (web/L1-L2 + C1): backend-only change to a
  follower/brand API path not exercised by the 66 web specs;
  re-run to confirm zero regression.

## Risk notes
- Very low risk: 2-line read-column change to the canonical
  column, verified-twice; no data/schema change. Main risk is
  an unaudited third reader — audited: only publishOpenGroup
  used the stale column.
