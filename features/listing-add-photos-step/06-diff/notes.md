# Before / after — Photos with variants

## What was implemented (frontend only)
The drill-down add/edit stepper no longer asks for photos up front. Photos are now
collected in Step 2, alongside the variants they describe.

- Step 1 (Basics): photo block removed; step-1 no longer requires a cover photo —
  it blocks only on name/price.
- Step 2: always shown now (label `Variants` when the leaf has variant facets, else
  `Photos`). Per-colour uploaders when colours are chosen; a single "Product photos"
  uploader when there are none. Photo requirement enforced here.
- Removed the `!hasVariantStep` step-skip so Step 2 is always a step.
- Review + save derive the main image from the first photo (`reviewImg` /
  `coverImage` fallback) — no separate cover needed.
- No backend change; edit mode inherits the reflow.

## What matches the mockup
- Step 1 = product info only; Step 2 = variant chips + per-colour photo uploaders,
  with a note that no-colour items show a single Product-photos uploader.

## What to check on the deployed screen
1. Add a fashion product: Step 1 has NO photo field and Next works with just
   name/price. Step 2 asks colours → per-colour photos; Next blocks until ≥1 photo.
2. Add a no-colour item (or a leaf with no colour facet): Step 2 shows one Product
   photos uploader; Next blocks until a photo is added.
3. The Review shows the uploaded photo; after save the inventory thumbnail is set.
4. Edit an existing product: photos load and can be changed; saving keeps them.
5. No product is created without a photo (final-save guard).

## Verification
- `pnpm qa` GREEN, gate 0 (2026-07-02).
- listing page JSX parses via Next babel.
- No fashion products in CI DB — verify the two-step photo flow on prod.
