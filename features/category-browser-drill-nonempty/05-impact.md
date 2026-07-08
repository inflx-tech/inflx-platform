# Impact — category-browser-drill-nonempty

**Verdict: one-line UX refinement; no backend, no new endpoint.**

- Mobile CategoryBrowser: falls back to the node's own subtree products when a
  level has no leaf child (init + drill). `listingNodeProducts` already returns
  the recursive subtree, so no backend change.
- Leaf-level behavior (Bracelets case) unchanged.
- Production-impacting: mobile OTA only.
- Rollback: revert one commit (segment-level grid returns to empty-until-drill).
