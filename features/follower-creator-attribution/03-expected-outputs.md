# 03 — Expected outputs

## Slice 1 — Per-line claim
- `CartContext` line shape gains `claim: { campaign_influencer_id, campaign_id,
  set_id, offer_id, source:'link'|'code', creator_handle } | null`. Stamped at
  add from `extra`; organic adds pass `null`.
- `CartScreen` builds `brand_groups` by grouping lines on
  `(brand_id + claim?.campaign_influencer_id)`. Each group carries that group's
  claim (campaign/set/CI/offer) or none. Two creators in one cart → two groups.
- Backend `placeOrder` unchanged (already prices each group via
  `priceOrderForGroup`); `verifyOrder` unchanged (already loops `sub_orders`).

## Slice 2 — Code door
- `POST /follower/resolve-coupon { code }` →
  `{ campaign_influencer_id, campaign_id, set_id, brand_id, offer_id,
     creator_handle, offer:{ type, label }, allocated_product_ids:[…] }`
  or `{ error }` (unknown / not contracted / campaign not live).
- Cart applies the claim to lines whose `brand_id === brand_id` **and**
  `product_id ∈ allocated_product_ids`; shows the creator discount in the bill.
- No other brands/items affected. A line already claimed via link is NOT
  overridden by a code (link wins, last-click).

## Slice 3 — Link door
- App handles `inflx.in/s/{handle}?cid&sid&oid&iid` (cold start + warm) → routes
  to the creator store screen with `{ campaign_id, set_id, offer_id,
  campaign_influencer_id }`. Android manifest intent-filter (APK) for the domain.

## Slice 4 — Post-order notify
- In `verifyOrder` per sub-order: if the sub has a creator, send `commission.sale`
  to that creator (reuse the pay-at-store pattern); always send `order.placed` to
  the brand's user. Follower `order.confirmed` unchanged. One ping per recipient
  per sub-order; deduped per distinct creator.
