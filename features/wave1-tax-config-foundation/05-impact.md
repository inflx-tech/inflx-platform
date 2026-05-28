# Impact — wave1-tax-config-foundation

## Changes
- 3 migrations (M072 + M073 + M074).
- 3 run scripts (run-072/073/074.js).
- 1 new service (`tax.service.js`).
- 1 service extension (`paymentConfig.service.js`).
- 4 controllers/services updated (subscription, webhook, withdrawal,
  pricing, escrow) — all replacing hardcoded reads with config reads.
- 1 contract folder.

## Blast radius
- `payment_config` table gains 11 new columns. All defaulted; existing
  row gets defaults via DEFAULT clause on first SELECT after migration.
- `categories` gains `return_window_days = 30` on all rows (matches
  current global default — no behaviour change).
- `influencers` gains `tds_exempt=false, tds_override_pct=null` —
  every existing influencer continues using the global TDS rate.
- `brands` gains `commerce_commission_override_pct=null` — every
  existing brand continues using the category×path rates.
- `paymentConfig.service` cache shape extends but is backward compatible
  for callers — they just see more keys.
- `subscription.controller` GST reads become awaited; minor function-sig
  consideration: all GST call sites are already inside async handlers.
- `webhook.controller` same.
- `withdrawal.service.createInfluencerPayout` becomes "if exempt → 0,
  else if override → override, else global" — semantically equivalent
  for any influencer who hasn't been touched by admin.
- `pricing.service` adds a per-brand override check above category
  lookup — semantically equivalent for any brand without an override.
- `escrow.service` T3 cron now uses configured time-of-day; before
  this, the cron fired the moment `content_live + N_days` rolled past
  midnight. Now: fires no earlier than the configured IST time on the
  day boundary.

## Rollback
Revert commit + revert M072/M073/M074 (DROP COLUMN). All defensive
fallbacks ensure code continues working even if migrations are
rolled back (or never applied).

## Risks
- **Cache staleness**: 60s max. Acceptable.
- **T3 cron behaviour change**: Pre-fix, T3 released at the first cron
  tick after `content_live + N_days`. Post-fix, releases at the first
  cron tick after `content_live + N_days @ release_time IST`. This is
  a slight delay (up to ~24h) for influencers whose T3 boundary
  crosses just before the configured time. The default '03:00:00 IST'
  means T3 releases between 03:00-04:00 IST → off-hours, won't impact
  brand notifications during business hours.
- **Per-influencer TDS opt-in**: requires admin to set tds_exempt or
  tds_override_pct. Until then, all influencers use the global rate
  (current behaviour).
- **GST hardcode replacement**: 7 sites total (5 in subscription, 2 in
  webhook). Each needs the `await` keyword. Will boot-smoke + qa to
  verify.
- **No regression for pnpm qa**: the suite hits subscription page +
  webhook signature check; none exercise GST math in detail. 76/76
  GREEN expected.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. M072 + M073 + M074 applied to local dev DB.
4. Sanity probe: payment_config row shows new columns with defaults.
5. gov-check exit 0.
6. Migrations bundled for one founder go after push.
