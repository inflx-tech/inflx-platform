# Impact — concept-p3-follower-backend

**Verdict: production-impacting (backend only), additive; one existing
endpoint's payload EXTENDED (PDP), nothing removed or reshaped.**

- New: GET /v1/follower/posts + /posts/:id (authenticateOptional, read-only).
  Feed reads creator_posts (empty in prod today → returns []). Detail joins
  live product/offer data per request — the runtime-tag principle.
- Changed: getProductDetail gains discount_value/offer_price/offers[] —
  pure additions to the payload; existing fields untouched (query re-aliased
  bp.* internally, same columns). Existing PDP consumers ignore new keys.
- sectionRules exports extended (OFFER_LIVE_GATE, OFFER_APPLIES) — constants
  already module-scoped; no behaviour change anywhere.
- Attribution: reuses buildTracking + the existing cart-claim path; a post
  product with no live campaign yields tracking:null (organic purchase),
  never an error.
- No DB changes, no mobile changes, no OTA. Rollback = revert commit.
