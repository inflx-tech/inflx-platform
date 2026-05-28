# Workflow — wave1-tax-config-foundation

## Actor
Admin (via the UI shipping in the follow-up commit) + backend services
that read the new config fields.

## Preconditions
- A6.5 / A13 (Razorpay subscriptions live) shipped.
- M072 + M073 + M074 applied on prod.
- Render redeployed with this commit's code.

## Workflow A — admin updates GST rate

1. Admin edits `payment_config.gst_pct` (via the follow-up admin UI
   OR direct PATCH to `/admin/payment-config`).
2. `paymentConfig.service.updateConfig` writes the row + busts the cache.
3. Within 60s any service that reads GST sees the new rate.
4. Next subscription upgrade / webhook charge / future-tax-bearing flow
   uses the new value.

## Workflow B — admin sets per-influencer TDS exemption

1. Admin opens an influencer detail page (follow-up commit).
2. Toggles `tds_exempt = true` (or sets `tds_override_pct = 0`).
3. Next withdrawal for that influencer skips TDS deduction:
   `withdrawal.service` reads `influencers.tds_exempt` first, then
   `tds_override_pct`, then falls back to `payment_config.tds_pct`.
4. Influencer sees `tds_deducted = ₹0` on their next withdrawal.

## Workflow C — admin sets per-category return window

1. Admin opens `/admin/pricing/categories` (follow-up commit).
2. Edits "Food delivery" category: `return_window_days = 7`.
3. Future follower purchases under that category set
   `follower_transactions.commission_releasable_at = now() + 7 days`
   (the Wave 3 cron). Pre-existing rows unchanged.

## Workflow D — admin sets T3 release time-of-day

1. Admin opens `/admin/settings/payments` (follow-up commit).
2. Sets `tranche_3_release_time_ist = '02:30:00'`.
3. T3 cron (hourly) reads the time and releases any T3 tranche where
   `content_live + N_days` boundary has crossed past `02:30 IST`.

## Workflow E — admin sets platform GSTIN

1. Admin opens `/admin/settings/payments` (follow-up commit).
2. Enters `platform_gstin = '29ABCDE1234F1Z5'`, business name, address.
3. Future invoices (Wave 4 PDF generator) embed these on the document.

## Workflow F — TCS toggle activation (future use)

1. Admin checks turnover monthly; once close to ₹50L:
2. Sets `tcs_pct = 1.00, tcs_active = true, tcs_active_from_date = '2026-07-01'`.
3. After that date, `tax.service.tcsOn(brandPortion)` returns the TCS
   amount; before that date / when active=false it returns 0.
4. The Wave 3 commerce settlement applies TCS automatically.

## Workflow G — deploy-without-migration safety

1. This commit pushes; Render redeploys.
2. M072/M073/M074 are not yet applied (founder hasn't run them).
3. Every code site that reads the new columns gets `null` → defensive
   `??` fallback (e.g. `config.gstPct ?? 18.00`).
4. Behaviour is identical to pre-deploy.
5. When founder runs the migrations later, new values take effect on
   next 60-second cache refresh.

## Success

- pnpm qa main lane GREEN.
- Backend boot smoke clean.
- Local sanity probes confirm:
  - M072: `\d payment_config` shows new columns
  - M073: `\d categories`, `\d influencers`, `\d brands` show new columns
  - M074: `\d payment_config` shows `tranche_3_release_time_ist`
- Both pre-M072 and post-M072 boot behave identically (defensive fallbacks).

## Failure modes

- One migration applied, another not → no break: each new column is
  independently defensive-read.
- Cache returns stale tds_pct just after admin update → 60s max.
  Acceptable.
- T3 cron runs but `tranche_3_release_time_ist` column missing → falls
  back to existing behaviour (releases at next cron tick after the day
  boundary).
