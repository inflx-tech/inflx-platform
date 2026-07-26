# Before / after — B2 (model + builder + resolver)

- **Before**: Discover existed only as a locked board; layouts lived in the
  old multi-layout App Builder (product-centric section engine); no way to
  compose concept-banner discovery, no resolved payload for the new tab.
- **After**: `discover_layouts` stores the ONE layout per scope; the admin
  Discover Builder (scope tabs, ordered rows, live-count banner picker,
  instant publish) authors it; GET /follower/discover serves the resolved,
  auto-hidden, rule-ranked payload the B3 tab will paint. Creator arranger
  endpoints are live for B4.

Verified during build (verify-twice catches): post_media columns are
slide_index/r2_key, posts carry scoped_brand_ids (no brand_id) — both
fixed before commit; dangling SQL binds in the rail resolvers fixed.

Definitive after-check: founder builds the real Global layout in the
Builder against prod concepts and sees honest counts; full visual truth
lands with B3's tab (board frame 1).
