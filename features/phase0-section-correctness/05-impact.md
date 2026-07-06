# Impact — Phase 0 section correctness

**Verdict: two intended follower-visible corrections (business-page offers
brand-scoped; un-pushed products leave creator surfaces) + admin-only
guardrails. No migration. No OTA required (admin web + backend only).**

- A1 narrows business-page Deals shelves to the brand's own offers — Home /
  category / creator screens pass no `brandId`, so their behaviour is
  byte-identical (unit-tested).
- A2 can shrink creator stores where brands un-pushed products after
  allocating — that is the intended fix; normal flow (push then allocate)
  sees no change. Checkout/coupon path deliberately untouched.
- B1/B2 are brand-web admin UI only; no follower surface, no API change.
- Backend changes are additive WHERE clauses behind existing ctx fields;
  rule cache key already includes brandId — no cache invalidation needed.
