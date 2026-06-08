# Workflow — follower-home-stories-listing

1. Add `creatorsListing(ctx)` to `sectionRules.service.js`; register as
   `creators_listing`. Logic: followed OR live-offer OR has-picks(approved-brand,
   active product); `has_live_deal` = real live offer; order followed-first then
   followers desc; city soft boost.
2. Migration 090 re-points `home/stories` rule → `creators_listing`.
3. Verify the rule vs prod read-only: returns active creators (incl. Sagar).
4. `pnpm qa` GREEN.
5. Push backend (Render auto-deploys the rule). Surface the prod migration
   (`run-090`) for explicit founder go; apply.
6. Confirm `/follower/home` returns a non-empty Stories shelf.

## End state
Home Stories carousel populates from listing/activity signal (Sagar + any other
active creators), ● LIVE only on real live offers. No app update needed.
