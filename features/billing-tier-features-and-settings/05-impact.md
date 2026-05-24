# Impact — billing-tier-features-and-settings (Phase A9)

## Changes
- 1 additive migration (column + seeds).
- 4 controller edits on subscription.controller.js.
- 1 admin UI extension (tier editor features textarea).
- 3 brand pages moved + 1 new layout file + 3 redirect stubs.
- 2 brand pages wired to QuotaWallModal (products, campaigns/new — 4 trigger sites total).
- 4 link path updates (layout header, dashboard banner, modal CTA, redirect targets).
- 1 brand spec rewritten with 4 tests.

## Blast radius

### Backend
- `features_json` reads added to 3 SELECTs — additive, no SELECT loses columns.
- Admin PATCH allowed-list +1 field, with explicit validation; rejects malformed input.
- Existing API consumers (mobile, frontend) ignore the new field silently if they don't use it.

### Frontend
- 3 page URL moves under `/dashboard/settings/*` — preserved by server-side redirects so bookmarks + external links don't break.
- 4 internal link references updated. Greppable confirmation done before the push.
- 12-item nav (was 14). Reordered grouping (Settings at tail). Window B will restyle nav rendering later; entries themselves stay.
- QuotaWallModal moves from "exists but unused" to "wired into 2 pages × 4 trigger sites". First user-visible appearance of the popup.

## Risks

- **Profile page is 603 lines; the move + 1 import-path char change is the only edit.** No logic changes — same file under a new directory. Vercel build must resolve the new path. Verified locally via Read of the new file.
- **Redirect stubs use server-side `redirect()`** — produces a 308 Permanent Redirect on the wire. Browser will cache it; if you ever want to un-move (un-Settings), users with cached 308s will keep redirecting. Acceptable risk; the Settings move is intentional and durable.
- **Quota wall wiring on campaigns/new is inside loops** (createSet + inviteInfluencer). On the n-th iteration hitting quota, the loop returns early with the partial `updatedSets`. The current draft state is preserved (already-created sets/invites stay); only the loop stops + the modal appears. Brand can dismiss + upgrade + retry.
- **Features list is display-only.** A brand looking at the Pro card sees "REST API access" but the API doesn't yet check tier on its endpoints. This is the explicit deferred work, not a bug. Documented in the Settings tab copy and in the contract.
- **Window B collision.** Touching products/page.js + campaigns/new/page.js for quota wiring is intentional. The wiring is 4 small `if (showFromResponse(res))` branches + 1 modal render at root + 1 import. Window B's restyle will touch styling/layout, not these data-binding lines. Merge cost is minimal.

## Rollback
- DB: drop column `features_json`. Code reading it falls back to the old SELECT shape (the JSON key just disappears from responses).
- Frontend: revert the commit. Vercel redeploys the prior bundle. Old URLs go back to serving the unmoved pages.
- Backend: revert controller edits; allowed-list shrinks; admin can't edit `features_json` anymore.

## Pre-push checklist
1. M060 applied locally → 4 tiers × 5 bullets each.
2. Re-apply M060 → no change (idempotent).
3. pnpm qa 75/75 GREEN, STATE=GREEN, gate=0.
4. gov-check exit 0 (Rule 1 contract-backed + Rule 3 mockup_locked + Rule 4 06-diff notes.md present).
5. Internal link grep clean (no remaining bare `/dashboard/profile` / `/dashboard/subscription` / `/dashboard/billing` except in the 3 intentional redirect stubs + nav's Settings entry pointing to settings/profile).
