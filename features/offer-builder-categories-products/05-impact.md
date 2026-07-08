# Impact — offer-builder-categories-products

**Verdict: additive data + picker polish; no matching/engine/payload change.**

- Backend: one new read endpoint (offer-categories) + listProducts now returns a
  resolved image per product (extra `facets` column read + map). No writes.
- brand-web: OffersLibrary fetches categories; ProductFinder shows thumbnails +
  price chips. Graceful fallback if the endpoint is missing.
- Offers still match on bp.section / product ids — unchanged.
- Production-impacting: Render (backend) + Vercel (brand-web) on push. No mobile,
  no OTA.
- Rollback: revert one commit.
