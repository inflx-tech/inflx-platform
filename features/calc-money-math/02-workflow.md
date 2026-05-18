# Workflow Definition — Money-math invariants (B2a)

> Step 3. Each case = a direct call to the exported pure function +
> assertions. No browser, no DB, no network.

## Actor
The QA runner importing `transaction.service` (CommonJS require).

## C1 — pay-at-store, clean case
`calcPayAtStore(1000, 10, 5, 8)` →
`{ discountAmount:100, netAmount:900, influencerCommission:45,
   platformFee:72, brandNet:783 }`.

## C2 — pay-at-store, default 8% fee, no discount/comm
`calcPayAtStore(1000, 0, 0, 8)` →
`{ discountAmount:0, netAmount:1000, influencerCommission:0,
   platformFee:80, brandNet:920 }`.

## C3 — pay-at-store, zero bill
`calcPayAtStore(0, 10, 5, 8)` → all five values `0`.

## C4 — online order, multi-item + delivery
`calcOnlineOrder([{price:200,quantity:2},{price:100,quantity:1}], 10, 5, 8, 30)`
→ `{ itemsTotal:500, discountAmount:50, netAmount:480,
     influencerCommission:22.5, platformFee:36, brandNet:391.5 }`
(discountedItems = 450; net = 450 + 30 delivery).

## C5 — online order, empty cart
`calcOnlineOrder([], 10, 5, 8)` → itemsTotal 0, all amounts 0.

## I1 — structural invariants (random-sampled inputs, r2-mirrored)
For a spread of (base, disc, comm, fee) incl. fractional:
- platformFee === r2(base·feePct/100)
- influencerCommission === r2(base·commPct/100)
- brandNet === r2(base − influencerCommission − platformFee)
- discountAmount === r2(base·discPct/100)
(base = bill for pay-at-store; discountedItems for online order)
verified against an in-test r2 mirror — locks the relationships
independent of fragile float literals.

## Success definition
All clean cases match EXACTLY and every invariant holds for every
sampled input. Any mismatch (esp. brandNet ≠ net − comm − fee, or
fee ≠ 8% of base) = FAILURE = a real money-logic regression.

## Failure / edge
- A change to the fee %, rounding, or brand_net formula breaks C*/I1
  loudly — exactly the regression this contract exists to catch.
