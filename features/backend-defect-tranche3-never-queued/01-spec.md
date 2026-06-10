# backend-defect-tranche3-never-queued

> Carved from Phase A golden-journey E2E (2026-06-10, `Docs/PHASE_A_RESULTS.md`
> defect D1). The final 50% tranche of every engagement/hybrid contract never
> auto-releases in production.

## Symptom

After a brand confirms all deliverables live (T2 releases correctly), the
tranche-3 escrow entry remains `status='locked', triggered_at=NULL` forever.
The hourly cron `jobs/tranche-3-release.job.js` selects only
`trigger_event='day_30_post_live' AND status='queued' AND triggered_at <=
now() - 30d` — conditions no code path ever sets. Influencers never receive
their final 50%; campaigns never reach auto-completion (completion is marked
inside the T3 release loop).

## Root cause (verify-twice: grep `day_30_post_live` + `triggered_at` across backend/src)

The only writes to `triggered_at` happen inside
`escrow.service.processTrancheRelease` (at release time). Nothing performs the
content-live → T3-armed hand-off. `deliverable.controller.confirmLive` releases
T2 when all deliverables are live but does not touch T3.

## Fix

In `confirmLive`, inside the same `db.withTransaction` block, immediately after
the T2 release: set T3 → `status='queued', triggered_at=now()` (guarded by
`AND status='locked'` for idempotency; conversion-only contracts have no
escrow rows and are unaffected).

Plus migration `097_backfill_t3_queue.sql`: for existing rows where T2 is
already released but T3 is still locked with NULL triggered_at, queue T3 with
`triggered_at = t2.released_at` so the 30-day clock counts from the real
go-live date.

## Proof of fix

Phase A driver step S7.2 flips from FAIL("GENUINE DEFECT") to PASS: post-live
T3 must be `queued` with `triggered_at` set; backdated 31d, the unmodified cron
releases it and marks the campaign completed.
