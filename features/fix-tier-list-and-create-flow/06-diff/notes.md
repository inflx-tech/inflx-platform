# 06-diff — A10.5

**Before:** founder opened `/admin/pricing/tiers` and saw an empty
table with "No tiers yet. Run migration M061 to seed." — even though
M061 had already been applied to Supabase prod and the data was sitting
there. The page silently rendered empty because the underlying admin
endpoint was never wired in any route file (regression since A7-admin
commit 3920772). Same with admin subscriptions queue, admin invoices.
Founder also couldn't create a new tier because no "+ New tier" button
existed.

**After:**
- The 5 missing admin subscription routes are mounted. The tier list
  populates with the 4 existing tiers (free / growth / pro / enterprise)
  showing legacy quota columns and an Edit button per row.
- "+ New tier" button appears top-right. Clicking it opens a small
  modal: tier_key (slug), display name, description. On Save, the
  backend creates the tier row, scaffolds 13 tier_features entries (one
  per catalog feature, included=false to start), and seeds one monthly
  price row at ₹0. The user is then redirected to the detail editor at
  `/admin/pricing/tiers/[tier_key]` to set price + flip features + enter
  quotas/configs (existing A10 surface).
- If the API ever fails again the page shows the real error message
  (red banner with the API error code + message). No more silent empty
  state.

**Visual style:** matches the existing admin page styling already in
use across `/admin/pricing/*` — yellow accent navy primary buttons,
red-pale error banner, white cards on bg2. No new design tokens.

**No regression on adjacent pages:** the detail editor at
`[tier_key]/page.js` is untouched. The features catalog page is
untouched. The brand-side subscription page is untouched. Only the
list page surface changed; only one controller function added.

**Verify-twice gap acknowledged:** the original A7-admin contract
claimed 8 admin endpoints shipped. In fact only the 3 escrow ones
were truly reachable; the 4 subscription/billing admin handlers were
defined but never route-mounted. A10's features wiring exposed the
mistake (founder saw features work + tiers empty side-by-side). This
A10.5 fix closes that gap honestly and the contract spec records it.
