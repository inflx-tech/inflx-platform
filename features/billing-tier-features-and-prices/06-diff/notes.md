# 06-diff — billing-tier-features-and-prices

**Before:** Admin tier editor was a single page editing all 4 tiers
inline — name, description, monthly price, the 4 quota columns
(campaigns, sets, influencers, products), an active checkbox, and a
"Features (one per line)" textarea backed by `features_json`. There
was no concept of a feature CATALOG: feature bullets were free-text
strings tied to display only. No yearly billing. No per-tier override
on quotas (the columns were single-valued per tier). Nothing called
out which features the code actually gated and which were marketing
copy. There was no way to create a new tier without a SQL INSERT.

**After:**

1. **Master feature catalog** at `/admin/pricing/features` — 13
   first-class features grouped by category (Influencer / Campaigns /
   Products / Brand-store / Support). Each has a slug, label,
   description, type (boolean / quota / config / baseline), default
   quota, and an `is_enforced` indicator showing whether the backend
   gate is wired. Admin can edit any label, default quota, or
   description inline. New features creatable via "+ Add feature"
   modal. Soft-delete (active=false) hides without losing data.

2. **Rebuilt tier list** at `/admin/pricing/tiers` — clean list view
   of 4 tiers + click-into editor. The previous all-tiers-inline page
   is replaced.

3. **3-section per-tier editor** at `/admin/pricing/tiers/[tier_key]`
   — Basics (display name, description, sort, active), Pricing
   (monthly + yearly price rows with discount preview), Features &
   Quotas (all 13 features grouped by category, per-feature inclusion
   checkbox + quota input + config blob editor for the two
   config-type features). One Save button writes everything in one
   transaction.

4. **Backend entitlements service** — `getEntitlements(brandId)` is
   now the single source of truth for "what features does this brand
   get". Returns `{tier_id, tier_key, entitlements: Map<key, {included,
   quota_value, config, feature_type, is_enforced, category, label}>}`.
   The brand's GET /subscription endpoint now includes this map in
   its payload (added alongside existing keys — zero breaking change).

5. **Yearly billing capable** — `subscription_prices` table per
   (tier × period). Monthly seeded from existing prices. Yearly admin
   adds via UI when ready. `brand_subscriptions` gets a
   `subscription_price_id` column so we know which cadence each
   subscription is billed on.

**What's NOT in this change (intentional, founder-locked):**
- Per-brand override (deferred to A14).
- Brand-side period toggle + entitlement-driven rendering (A11).
- Per-feature gate wiring — the `is_enforced` flag is false on all 13
  features today. Gates get wired one at a time in A12, starting in
  catalog sequence with discover_filter.
- Razorpay live mode for yearly (A6.5 / A13).

**Visual baseline:** Admin pages use the existing admin-web tailwind
palette (white cards, navy primary, mid-tone grays). No new design
surface introduced. Founder will restyle later if needed.

**Backward compatibility:** the brand subscription page at
`/dashboard/settings/subscription` continues to render today's layout
unchanged. The new entitlements field on the subscription endpoint is
additive; pages reading it (A11+) will switch over when their
contract lands.
