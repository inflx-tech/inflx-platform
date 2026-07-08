# Impact — listing-tags-at-add

**Verdict: additive only — no existing flow changes shape; products gain an
optional curated tags field in the drill-down wizard.**

- Backend: tags.service (scope query widened + new filter fn),
  listing.controller (insert gains a column it already has in the DB; PATCH
  gains an optional field; GET returns one more column). Flat flow untouched.
- `listTagOptions` widening also affects the flat flow's tag options — strictly
  additive (fashion-world tags become visible to fashion_* stores; other
  categories see identical results).
- Frontend: one chip row in the wizard details + edit; renders nothing when
  the world has no vocabulary.
- Rules already consume bp.tags — zero engine change.
- Production-impacting on push (Render + Vercel): explicit go required.
- Rollback: revert one commit; saved tags are inert data.
