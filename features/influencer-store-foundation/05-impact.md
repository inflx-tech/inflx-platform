# Impact — Influencer Store foundation

## Terse verdict
**Zero live-money-flow change — additive + dormant.** New table, new dormant column, new
influencer-only endpoints that nothing calls yet. The money path (`classifyPath`,
transactions) is UNTOUCHED in this slice.

## What changes mechanically
- Migration 094: `influencer_store_inventory` table + `follower_transactions
  .via_store_influencer_id` (nullable, unread).
- New `influencerStore.service.js` + `influencerStore.controller.js` + 4 routes under
  `/influencers/me/store/*`.
- Contract matrix derived from `campaign_influencers` (no new contracts table).

## Blast radius
- **Production-impacting** (backend/src + migration) but additive/dormant. Render deploy +
  migration carry no behaviour change. Rollback = drop the new endpoints (revert) / the
  table + column are harmless to leave.
- Money path, attribution, fees: not touched. Existing flows identical.

## Verification state (honest)
- Modules load clean; contract-gate + stockable + anti-hijack `resolveStoreContext`
  validated READ-ONLY against live prod data (sagartravel: 3 contracted brands → 69
  stockable; non-stocked product → null).
- Migration 094 applied to prod + verified.
- Full `pnpm qa` not runnable in sandbox (test DB unreachable) — additive/dormant, so no
  regression surface in the live path.

## Next slices (separate)
1. Attribution wiring: `classifyPath` store branch (store > live-link > window > direct);
   thread `via_store_influencer_id` + window-refresh through the 4 purchase paths; the
   authenticated "touch" endpoint (click/store-entry opens-refreshes window for logged-in
   followers). **Money-path — built + tested in isolation, surfaced before deploy.**
2. Influencer stocking UI (mobile) + follower Creator Store screen (rebuild to mockup).
3. End-to-end commission test plan.
