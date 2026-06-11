# Impact — sprint1 offer pipeline

**Verdict: unblocks the follower purchase funnel — additive endpoint + tap-param fixes; legacy entry points byte-identical.**

- Backend: ONE new read-only endpoint (GET /follower/store-offer/:id,
  authenticateOptional) reusing the tested adapter normalizers; no schema
  change, no migration; getStoreProducts untouched.
- Mobile: tap params now carry explicit identity (ci_id / brand_offer_id /
  source) + the offer mechanics payload; ProductDetail branches by identity;
  transact tracking converted to the long-form keys the payment endpoints
  validate. Old-style params (BrandStore et al) keep working via the
  legacyOfferId fallback.
- Risk surface: ProductDetailScreen load/dispatch — covered by journey
  S6.3/S6.4 (purchases) + S6.6a-c (tap paths) all green.
- Deploy: Render (backend) + OTA (mobile). No web impact.
