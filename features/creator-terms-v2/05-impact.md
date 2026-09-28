# creator-terms-v2 — impact

**Production-impacting.** Migration 194, backend (Render), brand website (Vercel), phone apps (OTA:
brand and influencer). Explicit go required before migrate, push, OTA.

## What changes for people
- **Brands (phone):** setting a creator's terms for Pay for Sale / Hybrid now means picking offers and
  products without offers (T1–T7). The old scope chips, the saved/special offer rows and the product
  picker are gone.
- **Brands (website):** the End offer dialog warns when the offer is in unsigned invitations, and the
  toast says how many were changed.
- **Creators (phone):** the invitation shows one "You can sell" row opening What you can sell and One
  offer (read-only, with example earnings); the agreement lists her offers; a Notifications screen.
- **Old phone apps** (before this OTA): sending Pay for Sale terms is refused with "What a creator can
  sell has changed. Update the app…". Pay for Content is unaffected.
- **Shoppers:** nothing (no shopper screens; Level 3 sells through posts).

## Existing collaborations
Untouched: `sell_v2` defaults to false; every reader keeps the old path for them.

## Money
None moves. No follower code is created for new-kind rows. Commission % and fees are unchanged.
The old storefront/checkout don't sell new-kind rows (Level 3).

## Data
Migration 194: four columns on `campaign_influencers` (`sell_v2`, `sell_mode`, `sell_product_ids`,
`withdrawn_reason`), two checks, one partial index; `collab_offers.dropped_reason`. Additive, no row
changes. `scripts/run-194.js --dry | --apply` prints collaborations and money before/after.

## Risk
- Invitations sent from an old app build are refused until the OTA lands: publish the OTA right after
  the push.
- The product-edit hooks are non-fatal (logged); a notice failure never fails a product save.
- Ending an offer now also changes invitations; it runs after the offer is ended and never throws.
