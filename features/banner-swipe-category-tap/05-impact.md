# Impact — banner-swipe-category-tap

**Verdict: two follower-facing renderer fixes; no backend, no data change.**

- Mobile: SectionRenderer reads the correct tap field (category_node_id) — fixes
  every banner/tile → category tap that previously mis-rendered. FullBleedStyle
  gains a multi-image swipe path; single-image path byte-unchanged.
- brand-web: wording only.
- No backend/schema/payload change. Existing sections resolve identically; the
  category tap now honors the node the admin already picked.
- Production-impacting: mobile OTA (both fixes) + Vercel (brand-web hint).
- Rollback: revert one commit; behavior returns to prior (single banner +
  tiles-grid tap).
