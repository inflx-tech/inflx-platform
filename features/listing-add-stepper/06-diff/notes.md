# Before / after — Listing Add stepper

**Before:** reaching a leaf (e.g. Saree) dropped the brand into a single panel
with **everything at once** — cover photos, name/brand/price/stock/SKU, the
leaf's full facet list (14 for a Saree), and per-colour variant cards — with
one lumped validation message ("Required: a, b, c, d").

**After (per 04-preview/mockups/stepper.html, founder-locked):** the leaf panel
is a 4-step wizard driven by `facet_role`:
- **① Basics** — photos + name + brand + price + stock; Next disabled until
  photo + name + price are valid.
- **② Variants** — only `variant`-role facets (colour, size) + the per-colour
  photo/stock cards. **Auto-skipped** when a leaf has no variant facets
  (furniture one-offs); the progress header hides step ② in that case.
- **③ Details** — required `descriptive`/`discovery` facets lead; the rest sit
  under a collapsed "More details" toggle.
- **④ Review** — summary card (photo, name, ₹, colours+stock, key facets) →
  **+ Add this item** stages it and snaps back to ① with **brand + common
  facets carried over** for the next product.
- Progress header with done/current states; per-step inline "Still needed: …"
  hint instead of the old single dump.

**Unchanged on purpose:** the tree drill-down, the per-colour variant cards,
image upload, and `saveBatch → batchCreate`. Same item objects, same auto-SKUs,
same backend — only *which fields show on which screen* changed.

**Verification:** `next build` compiled successfully (page emitted at
`/dashboard/products/listing`, 7.31 kB); `pnpm qa` 79/79 GREEN (no regression);
JSX parse clean. Per-step validation mirrors `taxonomy.validateItem` (and is
stricter on photos), so a step that passes can't fail server-side.

**Capture note:** before = the locked mockup; after = the founder's preview/
walk of the live wizard on a fashion + a furniture leaf (the release gate).
No Playwright URL capture — the page needs an authenticated brand + seeded
taxonomy; the production build + QA green stand in as the automated proof.
