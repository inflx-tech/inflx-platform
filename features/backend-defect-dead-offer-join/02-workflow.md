# Workflow — dead offer join

## W1 — a creator with a live collaboration is discoverable by a stranger
A creator has a contracted collaboration on a live campaign with an allocation. A follower
who does **not** follow them opens a creator section.
**End state:** the creator appears. Before the fix the section read "followed OR has a live
deal", the second half was always false, and they were invisible to everyone new.

## W2 — the live-deal marker is true when a deal is live
Same creator.
**End state:** `has_live_deal` is true. Before: false for every creator, always.

## W3 — a followed creator's deal count is real
A follower follows a creator with two live collaborations.
**End state:** the Following list shows **2** active deals. Before: 0 for everyone.

## W4 — browsing a category shows creators active in it
A creator has a live collaboration with a brand in the Fashion category.
**End state:** they appear under Fashion. Before: the section was always empty.

## W5 — the top-brands-by-engagement section fills
A brand has a live collaboration.
**End state:** the brand is eligible for the section. Before: always empty.

## W6 — a creator with nothing to sell stays hidden
A collaboration exists but has neither an allocation nor an offer.
**End state:** not surfaced. Widening the check must not surface creators with nothing to
sell — the same rule the storefront gates apply (contract collab-part4 W8).

## W7 — brands with a store-direct offer are unaffected
A brand has no campaign collaboration but a published store offer.
**End state:** still eligible via `anyLiveOfferExists`, exactly as before. That OR leg was
masking the defect for brands and must keep working.

## W8 — the V2-guarded offer rules are untouched
`offersV2Enabled` is on in production, so the 12 offer rules short-circuit to the adapter.
**End state:** unchanged behaviour; `OFFER_FROM` remains unreached.

## Regression guard
`pnpm qa` green, no new failures. Prod before/after counts recorded in 03-expected-outputs.
