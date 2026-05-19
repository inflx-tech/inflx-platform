# Preview (Step 4) — fix open-group publish mode mismatch

No UI. Backend 2-line fix. Reviewer note + Step-7 result here.

## Reviewer note (Step-5 lock)
- **PRODUCTION-IMPACTING** (backend runtime → Render). Founder
  GO 2026-05-19 ("if really broken fix it" — verified broken).
- Minimal, behaviour-consistent: `publishOpenGroup` reads the
  canonical `influencer_mode` (every other open-group path
  already does); no migration/backfill.
- Resolves carve `backend-defect-open-group-publish-assignment-
  mode-mismatch`; catching test flips by the backend fix only.

## Step 7 — RESULT — GREEN 2026-05-19 (RELEASED)
```
fix        : offer.controller.js:835,838 set.assignment_mode →
             set.influencer_mode (+ message text)
qa:db      : GREEN — _fix6_remeasure_qadb.log 17:20:36Z:
             '√ publishes the open-group set and returns 200'
             RED→GREEN; '√ returns 422 when set is not
             open_group' stays GREEN; 382/382, 54/54 mig
main pnpm qa: GREEN — 66 passed, C1 STATE=GREEN, gate 0
deploy     : PRODUCTION-IMPACTING (Render) — surfaced; founder GO
carve      : backend-defect-open-group-publish-assignment-mode-
             mismatch → resolved on green
```
