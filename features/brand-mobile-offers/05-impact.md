# Impact — A7
**Frontend-only, mobile (brand) — OTA. Zero backend.**
- Adds utils/offerBuilders.js + components/brand/ProductPickerSheet.js; extends
  BrandOffersLibraryScreen's builder with 3 new types.
Risk: creating an offer is a real state change — mitigated by client validation mirroring
the server validator (read directly), draft-vs-activate choice, and honest error surfacing.
Release: production-impacting via OTA → founder go.
Note: free_gift + category/product scoping remain web.
