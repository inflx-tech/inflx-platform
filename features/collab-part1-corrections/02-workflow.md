# Workflow — Part 1 Corrections

The workflows this contract must execute to their expected end state.

## W1 — Brand builds a library offer over unpublished products

1. Brand opens the offers page and creates a discount.
2. Brand picks a product that is not pushed to the store.
3. **Expected end state:** save is refused with a message naming the unpublished product.
   The brand publishes the product (or picks another) and the save succeeds.

## W2 — Brand builds an inline offer inside campaign creation

1. Brand is in campaign creation, on a conversion or hybrid set, configuring a creator's
   offer.
2. Brand picks products for a discount / volume / bundle / BOGO / free-gift offer.
3. **Expected end state:** the offer is accepted only when every referenced product belongs
   to this brand *and* is pushed to the store. A foreign product ID or an unpublished
   product is refused with a field-level message. Previously this path validated nothing.

## W3 — Brand unpublishes a product that is inside a live offer

1. Brand opens a listed product and turns off push-to-store.
2. **Expected end state:** the unpublish succeeds, and the brand is told which offers
   reference that product. Nothing is blocked; nothing is silently removed from the offer.

## W4 — Follower views a creator's storefront for a commission-only collaboration

1. A sales collaboration exists with a commission percentage and no discount offer value.
2. Follower opens the creator's storefront / resolves the creator's coupon.
3. **Expected end state:** no discount is displayed. The price shown is the price charged
   at checkout. (Before: the commission percentage was displayed as the customer's
   discount.)

## W5 — Brand opens campaign basics on a commission-only campaign

1. Brand starts campaign creation and reaches Step 1.
2. **Expected end state:** no wallet or escrow card is shown, because no set needs funding.
   Step order, step count and goal placement are unchanged from today.

## W6 — Brand opens campaign basics on a campaign with a paid set

1. Brand starts campaign creation with an engagement or hybrid set.
2. **Expected end state:** the money card shows the brand's *real* wallet balance, and the
   checklist ticks only what is actually true. No hardcoded ₹2,50,000, no pre-ticked
   "Wallet topped up".

## W7 — Brand sets a campaign start date of today

1. Brand starts campaign creation and picks today as the start date.
2. **Expected end state:** accepted. (Before: the wizard refused anything under 7 days out.)

## W8 — Offer type is consistent across apps

1. Brand invites creator A to a conversion set from the **web wizard** with a percentage
   discount.
2. Brand invites creator B to the same set from the **mobile app** with a percentage
   discount.
3. **Expected end state:** both collaborations store the same canonical offer type
   (`discount`), with the flat-vs-percentage distinction in the config sub-type. They
   filter, compare and report together.

## W9 — Existing rows keep working

1. Collaborations created before this change hold legacy values (`Discount`,
   `Volume discount`, `flat`, `percentage`, …).
2. **Expected end state:** the migration converts them to canonical values. Any row the
   migration misses still resolves correctly through the read-path normaliser rather than
   failing to match — no storefront or coupon regression.

## Regression guard

`pnpm qa` green, no new failures. The offer, campaign, contract and follower suites are the
ones with exposure here.
