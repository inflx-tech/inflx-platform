# Impact

**Chat verdict:** frontend-only stepper reflow. Removes the duplicate/early photo
ask; no backend change, no migration, no data-shape change.

## Surface area
### Frontend (UI-governed) — single file
`Packages/brand-web/app/dashboard/products/listing/page.js`:
- Step 1 photo block removed; step-1 validation drops the cover requirement.
- Step 2 now always renders; label `Variants`/`Photos`; adds a single "Product
  photos" uploader when no colours are selected.
- Photo requirement (`hasAnyPhoto`) moved to step 2 + `draftErrors`.
- Removed the `!hasVariantStep` skip in goNext/goBack and STEP_DEFS (step 2 is
  always a step now).
- Review image falls back to the first colour photo (`reviewImg`).

### Backend
- **None.** `coverImage` already falls back to the first variant image;
  `buildVariants` already stores `cover_images` + per-colour images. The Excel bulk
  path (URL columns) is untouched.

## Blast radius / risk
- **Products with colours:** now single-source their photos per colour; main image
  derives automatically — no behaviour loss.
- **Products without colours:** get the single uploader in step 2 (previously the
  step-1 cover) — same net capability, later in the flow.
- **Edit mode:** shares the form, so it benefits automatically; legacy cover images
  on old products persist on save (passed through `draft.images`).
- **Other verticals:** don't use this stepper — unaffected.
- **Server validation:** `taxonomy.validateItem` never required photos (backend
  treats them optional); moving the client requirement can't cause a server-side
  divergence.

## Related
Builds on [[listing-add-stepper]]; complements [[listing-product-edit]],
[[listing-product-description]], [[listing-product-mrp]].
