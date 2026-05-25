# Impact — billing-brand-period-toggle (A11)

## Changes
- 1 backend controller extended (`subscription.controller.js`) — `listTiers` + `upgrade`.
- 1 frontend page rewritten (`dashboard/settings/subscription/page.js`).
- 1 api client method extended (`brandApi.upgradeSubscription`).
- 1 contract folder.

## Blast radius
- API responses additive (new fields on existing shape). Existing consumers of `monthly_price_inr` / `features_json` / `max_*` unchanged.
- Upgrade endpoint: new optional `billing_period` param; old clients keep working.
- Brand subscription page: full rewrite, same path. Renders entitlements (new) but degrades gracefully when entitlements array is empty (just shows the tier name + price + Choose button).
- Backend `brand_subscriptions` rows now persist `subscription_price_id` going forward; old rows already backfilled by M061.

## Rollback
Revert the commit. Frontend renders the previous bullet-list view. Backend stops including the new fields. No DB rollback needed (M061 was independent).

## Risks
- **Yearly chosen but no yearly price set** → 422 surfaces cleanly. Founder still needs to enter yearly prices via `/admin/pricing/tiers/[tier_key]` before brands can upgrade to yearly. Today's prod has no yearly prices seeded — toggle works visually, upgrade-to-yearly returns 422 until admin sets them.
- **Entitlements not populating for a tier** → tier card renders just the basics (price + Choose button). No feature bullets. Acceptable graceful degradation.

## Pre-push checklist
1. pnpm qa GREEN (no spec changes; existing pass).
2. Backend boot smoke (`node -e require('./src/app')`) clean.
3. gov-check exit 0 with Rules 1+3+4.
