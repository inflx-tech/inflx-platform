# Workflow — tranche-3 auto-release end state

1. Brand confirms the LAST deliverable live (`POST /v1/deliverables/:id/confirm-live`).
2. Same transaction: deliverable → 'live', CI → 'active', T2 released, **T3 → status 'queued' + triggered_at=now()** (the fixed hand-off).
3. 30 days later (admin-configurable), at/after 03:00 IST, the hourly `tranche-3-release` cron matches the entry → releases the final 50% to the influencer wallet → marks the campaign completed when all CIs settle.
4. Backfill path (one-time, migration 097): T3 rows whose T2 already released get queued with `triggered_at = t2.released_at`; entries already past 30 days release on the next cron tick after deploy.

Expected end state: no escrow entry can exist with `tranche_number=3, trigger_event='day_30_post_live', status='locked'` while its sibling T2 is 'released'.
