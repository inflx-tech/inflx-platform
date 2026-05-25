# 06-diff — billing-brand-period-toggle (A11)

**Before:** brand subscription page showed 4 tier cards each driven by
the legacy `monthly_price_inr` column + the M060 `features_json` array
(plain bullet strings). No Monthly/Yearly toggle. No way to see what
admin had configured in the new feature catalog. Brand on Growth tier
with Discover filter set to "state, 10 niches" by admin saw none of
that — just the legacy 4 quota numbers.

**After:** the page reads from the new entitlements payload and renders:

- Monthly/Yearly toggle at the top of "Available plans" — clicking
  swaps the price displayed on every tier card simultaneously.
- Each tier card groups features by category:
  - **Influencer** (5 features): Discover filter with its scope+niches
    metadata, Advanced search filters ✓/✗, Bulk outreach ✓/✗, Invitations
    per cycle quota, Open-group broadcast with scope+recipients metadata.
  - **Campaigns** (2): Active campaigns + Sets per campaign quotas.
  - **Products** (2): Products in store + Media gallery quotas.
  - **Brand store** (1): Multi-branch support ✓/✗.
  - **Support** (3): Self-serve baseline + Dedicated onboarding ✓/✗ + 24×7 phone ✓/✗.
- "Save N% vs monthly" callout under the yearly price when admin has
  set both monthly and yearly and the yearly works out cheaper.
- "Not available" disabled button when admin hasn't set a price for
  the selected period on a tier.
- Real error banner (red) for any API failure instead of silent empty
  rendering — prevents the kind of bug we hit on the tier list page
  in A10.5.

**Backend changes:** `GET /subscription-tiers` now returns enriched
data (prices + entitlements per tier). `POST /brands/me/subscription/upgrade`
accepts an optional `billing_period` ('monthly' default) and resolves
the matching `subscription_prices` row; 30-day cycle for monthly, 365
for yearly. Existing clients sending just `tier_key` work unchanged.

**Quota popup wiring correction:** I previously told the founder that
the quota popup wasn't wired into the create-product / create-campaign
pages. That was wrong — A9 already wired it. Confirmed by grep:
products/page.js imports QuotaWallModal + useQuotaWall + uses
showFromResponse in 2 places + renders the modal once at page root.
campaigns/new/page.js does the same for createCampaign, createSet,
inviteInfluencer. No A11 touchup needed on those pages.

**Visual style:** matches the existing wave2 palette used on every
dashboard page. No new design tokens. Founder will restyle later.

**No regression on adjacent pages:** the /dashboard/settings/profile
+ /dashboard/settings/billing pages + the admin pages are all
untouched. Only the subscription page surface changed.
