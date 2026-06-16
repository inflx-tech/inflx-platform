# 02 — Workflow: Phase 5e/5f Store + Checkout Sweep

Actors: follower across Brand Store, Offers/Deals, Orders, Restaurant detail,
Profile/wallet, and the error fallback.

## Steps (what changes)
1. Brand Store — unchanged (verified already palette-consistent; no white-on-gold).
2. Deals/Offers — active filter chip + sort pill text now ink-on-gold.
3. Order History — active tab text ink-on-gold.
4. Restaurant detail — Follow/Directions CTA text ink-on-gold.
5. Error fallback — "Try again" button text ink-on-gold.
6. Profile — wallet balance card + refer button text ink-on-gold.

## Non-goals
No layout change, no fetch/logic/navigation change. No backend/DB/API/migration.
Brand-Store→section-engine migration explicitly deferred (separate backend build).

## Proof
`pnpm qa` GREEN gate 0. Visual confirmed against the locked palette/mockups at the
joint 5→6 founder verify.
