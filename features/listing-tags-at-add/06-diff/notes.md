# Before/after — listing-tags-at-add

## Before
- Drill-down wizard: no tag input anywhere; create/edit endpoints dropped any
  `tags` field; getListingProduct didn't return tags.
- Tag options scoped by EXACT brand.category — fashion's 3 category keys would
  fragment one world's vocabulary.

## After
- Wizard details step (add + edit): "Tags (optional)" chip row under the
  description — admin's world tags only, amber when selected; row absent when
  the world has no vocabulary. Selections carry to the next staged item (like
  Brand) for fast batch tagging.
- Backend: insertProducts stores `tags` (curated-filtered against vocabulary,
  resolved once per batch); PATCH accepts `tags` (undefined = untouched);
  GET returns them. Unknown/free tags are dropped at the API — curated-only is
  enforced server-side, not just in UI.
- Tag scoping world-aware: scope IN (category, world, 'ALL'); fashion* shares
  the 'fashion' pool. Admin page scope defaults gain 'fashion'.

## Verification
- Backend boots + serves with changes (manual boot check).
- brand-web `next build` ✓ compiled; `pnpm qa` GREEN (79) — one intermediate
  FAILED run classified as transient env (6 api specs all timed out at 60s;
  backend start race; re-run green, backend verified booting).
- After-capture owed on founder's next walkthrough: admin creates a fashion
  tag → chip appears in wizard → rule "tags" matches the product.
