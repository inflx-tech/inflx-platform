-- 097 — Backfill: arm stuck Tranche-3 escrow entries.
-- Contract: features/backend-defect-tranche3-never-queued
--
-- Before this fix, nothing flipped T3 to 'queued' / stamped triggered_at when
-- content went live, so the tranche-3 cron could never match them and the
-- final 50% never released. Data backfill only — no schema change.
-- The 30-day clock starts from T2's actual release date (the real go-live),
-- so influencers whose content has been live > 30 days release on the next
-- hourly cron tick.

UPDATE escrow_entries t3
SET status       = 'queued',
    triggered_at = t2.released_at
FROM escrow_entries t2
WHERE t2.campaign_influencer_id = t3.campaign_influencer_id
  AND t2.tranche_number = 2
  AND t2.status = 'released'
  AND t3.tranche_number = 3
  AND t3.trigger_event = 'day_30_post_live'
  AND t3.status = 'locked'
  AND t3.triggered_at IS NULL;
