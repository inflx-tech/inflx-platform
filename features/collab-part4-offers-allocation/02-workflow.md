# Workflow — Part 4 Offers and allocation

The workflows this contract must execute to their expected end state.

## Allocation (§4.1)

**W1 — brand allocates the entire store.** Brand picks a creator in a conversion set and
chooses scope *entire store*. End state: the creator's storefront lists every published
product. No offer is required for this to work.

**W2 — auto-join.** With W1 in place, the brand publishes a new product. End state: it
appears for that creator with no further action. (Founder's explicit choice.)

**W3 — brand allocates a category.** Scope *category*, node = Jackets. End state: the
creator's storefront lists Jackets and every subcategory beneath it. A new product added to
Denim Jackets appears; a new Kurta does not.

**W4 — brand allocates individual products.** Scope *products*, three picked. End state:
exactly those three. A newly published product does **not** join.

**W5 — unpublish removes reach.** Brand unpublishes a product. End state: it leaves every
store- and category-scoped creator's storefront automatically, because allocation follows the
published store. No separate exclusion flag is involved.

**W6 — existing collaborations are untouched.** The 19 production collabs are migrated with
an allocation scope backfilled from their offer's current scope. End state: each one resolves
to the same product set as before the change.

## Selling without a discount (§4.2)

**W7 — full-price sale, commission only.** A creator has an allocation and a commission %, and
**no offer of any kind**. A follower opens their storefront, buys a product at full price with
their code. End state: the storefront renders, the coupon resolves, the sale is recorded, and
commission is credited. Today this fails in seven places — including `validateTracking`, so
the sale cannot even be recorded.

**W8 — no allocation means no storefront.** A contracted creator with no allocation. End
state: hidden, not an empty shop.

## Offer resolution (§4.3)

**W9 — a global offer reaches a creator with nothing assigned.** Brand publishes *10% off
everything*. Creator has an allocation and no creator-specific offer. End state: their
products carry the 10% without the brand assigning anything per creator.

**W10 — creator-specific beats global.** Global *10% off everything*; creator-specific *20%
off Denim Jackets*. Cart = jacket ₹4,000 + kurta ₹1,500. Candidates score ₹550 (global) and
₹800 (specific). End state: **₹800** applied. One offer, not both.

**W11 — a bundle is never broken by an override.** Global *bundle kurta+dupatta+leggings
₹2,999* (₹1,201 off); creator-specific *25% off kurtas* (₹350). Cart = all three items. End
state: **₹1,201** applied — the bundle wins because it is better, and no product was pulled out
of the cart to serve the override.

**W12 — a creator-specific offer never makes the customer worse off.** In any cart, the
applied discount is ≥ what the best global offer alone would have given. End state: holds by
construction, and is asserted.

**W13 — nothing stacks.** Global *15% off everything* and global *30% off jackets*, both
published. A jacket scores 30%. End state: **30%, never 45%.**

**W14 — unpublished offers do not reach creators.** A library offer with
`published_to_store = false`, or outside its live window. End state: never a candidate.
(§5.1, founder-answered.)

**W15 — pay-at-store bill.** No line items, only a bill total. End state: only store-scope
candidates can win; offers needing line items score zero with a reason. Same as today.

## Offer expiry (§4.4)

**W16 — an offer expires, the collaboration continues.** A creator's offer passes its expiry.
End state: the discount stops applying; their allocation, storefront and commission are
unchanged, and they keep selling at full price. Today the discount only ends when the campaign
does.

**W17 — a library offer's own dates are honoured on the coupon path.** Currently ignored there.
End state: an out-of-window library offer does not discount.

## Retiring the dead set-level path (§4.5)

**W18 — removal is provably inert.** `campaign_offers` has zero rows in production, so every
`LEFT JOIN` on it yields only NULLs and every `COALESCE` already falls through. End state: each
of the 49 references removed with a before/after equivalence check, not one sweep.

## Regression guard

`pnpm qa` green with no new failures, run **twice**: once after §4.1/4.2/4.4/4.5, and again
after §4.3, so a pricing regression is attributable to a known change. The offer, campaign,
transaction, commission and follower suites carry the exposure.
