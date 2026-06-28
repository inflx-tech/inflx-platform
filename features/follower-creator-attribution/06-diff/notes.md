# 06 — Before / after notes

## Slice 1 — Per-line claim (mobile only)

**Before:** the creator tag lived at **cart level** (one per cart). A multi-brand
cart attached it only to the lead brand; a second creator (or a second creator on
the same brand) was dropped to organic or overwrote the first → only one creator
ever got credited.

**After (`04-preview/mockups/cart-multi-creator.html`):** the claim lives on the
**LINE**. Each item added from a creator's store/link is stamped with that
creator's `claim { campaign_influencer_id, campaign_id, set_id, offer_id, source,
creator_handle }`; organic adds carry `null`. At checkout the cart groups by
**(brand + claiming creator)** and sends one `brand_group` per group, so each
creator is credited only for the items they drove and organic items stay organic.
The follower still sees ONE flat list + ONE bill.

## Delivered
- `services/CartContext.js` — `buildClaim(tracking, extra)`; `addItem` /
  `forceReplaceWith` stamp the per-line claim and fold the claiming creator into
  the `line_key` (same product via two creators → two distinct lines).
- `screens/follower/CartScreen.js` — `placeShopOrder` groups by (brand + creator)
  from line claims → `brand_groups` (or the legacy single payload when one group);
  each item shows a subtle **"via @creator"** pill, organic items show
  **"Added by you."**
- **Backend:** none — `placeOrder` already prices each `brand_group`
  independently and `verifyOrder` already loops `sub_orders`; two groups for the
  same brand with different creators already work.

## Verification
- mobile jest **20/20** (FollowerWallet baseline excl.); CartScreen transforms
  clean. `pnpm qa` unaffected (no backend change).
- Live-verify on [FTW]: add items from two different creator stores (+ one organic
  item) → one bill → Place Order → Orders shows one order per (brand+creator),
  each creator credited for their items only.

## Next slices
- **Slice 2** code door (`resolve-coupon` + cart code field). **Slice 3** link
  door (deep-link). **Slice 4** post-order creator/brand pings.
