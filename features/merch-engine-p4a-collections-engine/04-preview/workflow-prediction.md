# Workflow prediction — Phase 4a (collections engine)

Mockup: `04-preview/mockups/collection-render.html` (follower-side render).

What it asserts (for sign-off):
- A placed Collection renders as a **titled header band** (collection name + optional image) +
  its **member sections as normal shelves**, inline, in order.
- Member shelves are ordinary Phase-3 sections → they stay **context-aware** (creator/brand/
  city stack). Empty members hidden; all-empty collection → no band.
- Only ONE new mobile piece: the `collection_header` band. Everything else is existing shelves.
- Palette in the mock is indicative only — the gold/cream re-skin is Phase 5; 4a is structure.

Engine: a `rule='collection'` placement pre-expands into header + per-member `library_products`
synthetic rows; the existing loop renders them; an empty-header post-pass removes a band with
no populated members.
