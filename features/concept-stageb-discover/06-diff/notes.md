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

## B4 — Creator "My Store" (board b4-mystore.html, revised for full parity)

- **Before**: creators had no control over their follower-facing page order;
  the creator layout endpoints existed (B2) with no UI.
- **After**: Create tab → "My Store" — sections → optional chips → their
  qualifying concepts (auto-derived, live counts), drag order (▲▼), cover
  picker (their own posts front the banners; newest as default), show/hide
  toggle, first-visit auto-flat-list, "Add to your store" pool, preview
  sheet, instant Save. Follower side: the creator store page renders their
  arranged "Shop my edits" rails (resolver truth: dark concepts vanish,
  lead-post cover falls back to newest if the lead goes dark); banner tap →
  their posts only for that concept. Rules/CTA/art stay admin-only.

## B5 — Business page auto-structure (board b1-discover.html frame 2)

- **Before**: brand store pages had no Discover rails; the admin's
  Business-structure layout (authorable since B2) had no consumer; feed
  had no brand filter, so a store-scoped banner tap had nowhere honest
  to land.
- **After**: BrandStore renders the resolved Business structure for THIS
  brand above the tabs — concept banner rails (counts/covers from this
  brand's posts only) + "creators of this store" rails; rows with
  nothing behind them never arrive (resolver auto-hide, zero per-store
  setup). Feed gains brand_id filter (scoped_brand_ids containment);
  ConceptPosts passes it, so a store banner opens exactly that store's
  posts for the concept.
