# 06-diff — billing-tier-features-and-settings

**Before:** the brand looking at the subscription page saw four tiers
with just the four quota numbers (campaigns / sets / influencers /
products). Nothing told them what else they got on Pro vs. Growth.
Hitting a plan limit triggered a generic "Failed to save" toast with
no explanation or upgrade path. Profile, Subscription, and Billing
were three separate top-level nav entries, cluttering the navigation.

**After:**

1. **Each tier card now shows a "What you get" list** below the quota
   bullets. Admin manages this list from `/admin/pricing/tiers` — a
   simple textarea, one feature per line. The brand sees green
   checkmarks next to each bullet. Today the bullets are display-only;
   later contracts will wire individual features to actual code gates.

2. **The quota popup actually pops up.** A brand on the Free plan
   trying to create their 11th product, or trying to create a second
   campaign, or trying to invite a 6th influencer, now sees a modal
   that names the limit, shows the upgrade-to tiers, and has a "View
   plans" button that lands them on the subscription page. No more
   silent failure.

3. **Settings is one nav entry, not three.** The Settings menu item
   opens a hub with a top-tab nav switching between Profile,
   Subscription, and Billing. Bookmarks to the old URLs still work —
   they redirect to the new settings sub-route automatically.

**Window B coordination:** the dashboard nav got shorter by 2 items
and the products + campaigns/new pages got 5 small `if` branches +
1 modal render added. The visual layout is otherwise identical. Window
B's planned restyle of these pages preserves the data-binding lines;
merge cost is minimal.

**No regression on existing pages.** The 3 moved pages preserved
their entire bodies; only the 3-deep `../../../lib/api` import
became 4-deep `../../../../lib/api`. The redirect stubs at the old
paths are 5 lines each, no logic. Verified by pnpm qa staying green.

**Verification:**
- pnpm qa 75/75 GREEN (was 73 baseline + 2 new redirect tests; the
  2 existing content tests updated to the new settings URLs).
- All 4 redirect tests pass — old URLs land on their new home.
- Features bullets render under each tier card on the Settings
  subscription tab.
- gov-check rules 1+3+4 satisfied.

**Honest trade-off recorded:** the features list is decorative until
each feature is wired to enforcement. A brand on Pro could click
"REST API access" today and nothing different happens. This is the
deliberate phasing per founder direction: ship the marketing surface
first, wire enforcement feature-by-feature later.
