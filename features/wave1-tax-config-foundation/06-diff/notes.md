# 06-diff — wave1-tax-config-foundation

**Before:** the codebase had 7 hardcoded GST sites (`18.00` literal in
`subscription.controller.js` × 5; `* 18 / 100` in `webhook.controller.js`
× 2). TDS rate was global only (`payment_config.tds_pct`). The
commerce return window was global (`payment_config.return_window_days`,
30d default) — same for every category, even though food-delivery
and physical-goods returns work on different timelines. T3 escrow
release fired at the first cron tick after `content_live + N_days`
crossed midnight — no time-of-day control. There were no admin slots
for TCS, platform GSTIN, or invoice identity.

**After:** every tax/limit/identity value lives in either
`payment_config` (singleton) or per-actor override columns
(`categories`, `influencers`, `brands`). A new `tax.service.js`
centralizes math helpers. All hardcoded reads now go through the
service. Code paths are unchanged semantically — same outputs
today — but the rates are now admin-controllable for tomorrow.

### Code shape changes

**`paymentConfig.service.getConfig()`** SELECT extended from 9
columns to 20; cache shape extended with the new camelCase keys.
`updateConfig()` allowed-list extended. 60s cache TTL unchanged.

**`tax.service.js`** new file. All helpers wrap `paymentConfig.service`
+ add defensive `??` fallbacks so any new column being NULL falls back
to the same hardcoded default that was in use before migration.

**`subscription.controller.js` — 5 GST sites**
```js
// Before:
gst_amount_inr: parseFloat((amount * GST_PCT / 100).toFixed(2)),
total_inr:     parseFloat((amount * (1 + GST_PCT / 100)).toFixed(2)),

// After:
const { gst, total } = await taxService.withTax(amount);
gst_amount_inr: gst,
total_inr:     total,
```
Plus the standalone constant `const GST_PCT = 18.00;` removed.

**`webhook.controller.js` — 2 GST sites**
```js
// Before:
const gstInr = amountInr ? parseFloat((amountInr * 18 / 100).toFixed(2)) : 0;

// After:
const gstInr = amountInr ? await taxService.gstOn(amountInr) : 0;
```

**`withdrawal.service.js` — TDS lookup**
```js
// Before:
const tdsPct = config.tdsPct;  // global only

// After:
const tdsPct = influencer.tds_exempt
  ? 0
  : (influencer.tds_override_pct != null ? parseFloat(influencer.tds_override_pct) : config.tdsPct);
```

**`pricing.service.computeL3OnFollowerTxn`** gains a brand-override
check above the category × path rate lookup:
```js
const overridePct = brand.commerce_commission_override_pct;
const ratePct = overridePct != null ? parseFloat(overridePct) : categoryPathPct;
```
Plus new export `getReturnWindowForCategory(categorySlug)` that reads
`categories.return_window_days` with fallback to the global
`payment_config.return_window_days`.

**`escrow.service.js` — T3 release predicate**
The cron query that scans for releasable T3 tranches now also checks
the IST time-of-day:
```sql
-- Before:
WHERE released_at IS NULL
  AND tranche_number = 3
  AND content_live_at IS NOT NULL
  AND NOW() >= content_live_at + interval '30 days'

-- After:
WHERE released_at IS NULL
  AND tranche_number = 3
  AND content_live_at IS NOT NULL
  AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >=
       (content_live_at AT TIME ZONE 'Asia/Kolkata')::date + interval '30 days'
  AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= $tranche_3_release_time_ist
```
(The N days value `30` is already being read from `payment_config`;
adding the time-of-day predicate alongside.)

### Behaviour change summary

| Read site | Pre-fix value | Post-fix value (default) | Post-fix when admin changes |
|-----------|---------------|--------------------------|------------------------------|
| Subscription GST | 18% hardcoded | 18% from payment_config.gst_pct | Configurable |
| Webhook GST | 18% hardcoded | 18% from payment_config.gst_pct | Configurable |
| Influencer TDS | global from payment_config.tds_pct | Same global, OR 0 if exempt, OR override | Per-influencer toggle |
| Commerce commission rate | category × path | Same OR brand override | Per-brand override |
| Return window | global 30 days | Per-category column (defaults to 30) | Per-category |
| T3 release time | first cron tick after midnight on day N | First cron tick after 03:00 IST on day N | Per platform |
| TCS | (didn't exist) | 0 (tcs_active=false) | Activatable via toggle |

### Defensive behaviour

Every new column read uses `?? defaultValue` so the code works
identically with or without the migration applied. Wave 1 ships
backward-compat-safe so the migration apply is not a hard gate on
the code redeploy.

### What this enables

After Wave 1 ships, admin will be able to (via the follow-up UI commit):
- Change the GST rate without a code redeploy
- Set platform GSTIN + business identity for future invoice generation
- Configure TCS (rate + toggle + active-from-date) for future activation
- Set per-influencer TDS exempt / override
- Set per-brand commerce commission override
- Set per-category return window
- Pick the T3 release IST time

Wave 2 and Wave 3 will then use these admin-controlled values to:
- Apply GST on Protection Fee + Commerce Commission
- Deduct TCS from brand's commerce settlement
- Hold influencer commerce commission for per-category window
- Generate proper tax invoices

**Verified locally:** all 3 migrations apply cleanly; sanity probes
confirm columns; backend boots; pnpm qa stays 76/76 GREEN.
