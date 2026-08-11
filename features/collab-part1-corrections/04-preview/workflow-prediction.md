# Workflow prediction — Part 1 Corrections

What we expect to observe once implemented, per workflow in `02-workflow.md`.

## W1 — library offer over an unpublished product
Save is refused, HTTP 422, field `offer_config_json.products`, message naming the
unpublished product. After the brand publishes that product, the identical payload saves.

## W2 — inline offer inside campaign creation
Foreign product ID → 422 "referenced product is not owned by this brand".
Unpublished product → 422 naming it. Both are new: this path previously accepted anything.
A valid payload behaves exactly as before.

## W3 — unpublishing a product inside a live offer
Unpublish returns success. Response carries the list of offers referencing the product.
The offers themselves are unchanged. Nothing blocks.

## W4 — storefront for a commission-only collaboration
Storefront and coupon-resolve report no discount. Previously the commission percentage
appeared as the customer's discount. The price displayed now matches the price charged.

## W5 — campaign basics, commission-only campaign
No wallet/escrow card rendered. Checklist present with honest ticks. Step order, step
count and goal placement identical to today.

## W6 — campaign basics, funded set
Card shows the brand's real wallet balance. The "wallet covers this" tick is green only
when the balance actually covers the allocated set budgets, amber otherwise. No ₹2,50,000
anywhere.

## W7 — start date of today
Accepted by the date input and by save. Backend still rejects an end date on or before the
start date.

## W8 — same offer from both apps
Web percentage discount and mobile percentage discount both store offer type `discount`,
with flat-vs-percentage in the config sub-type. They group together in any query filtering
on offer type.

## W9 — pre-existing rows
Migration reports the number of rows converted per legacy value. Post-migration, no
`campaign_influencers.offer_type` value sits outside the canonical five. A deliberately
un-migrated value still resolves through the read normaliser — no storefront or coupon
regression.

## Regression
`pnpm qa` green, no new failures versus the pre-change baseline. Offer, campaign, contract
and follower suites are the ones with exposure.
