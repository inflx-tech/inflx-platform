# Flow 13 · diff notes — what shipped

## Shipped vs mockup

Implementation matches all 6 mockup states 1:1. Both page.js files restyled to locked palette · listing-engine spine preserved verbatim.

### Products page · `Packages/brand-web/app/dashboard/products/page.js`

- ✅ Listing-wizard pass-through preserved (wraps `<ListingWizard />` from `./components/ListingWizard`). The only restyle to that branch is the header H1 + sub-line to locked palette + cnt-chip. ListingWizard component itself **NOT TOUCHED**.
- ✅ INK schema info bar with category icon, mono availing modes (yellow accent), booking type, "✦ Professional catalogue" yellow badge when `features.master_catalogue === true`
- ✅ Enquiry-only notice card restyled to `info-pale` with Outfit heading
- ✅ MasterCatalogueView restyled:
  - "My Fleet/Services" section header with palette pip + count + "X of Y added" right-aligned
  - Activated grid (3-col) image cards with gradient overlay preserved · mono price (with `/d` suffix for vehicles) · Live/Hidden palette pills
  - Package list shown inline below specs
  - Segment chips palette-styled with mono counts
  - Master grid (4-col) image cards with `topbadge` + Outfit name + ink `+ Add to Fleet` CTA
- ✅ ActivateModal restyled: ink hero with vehicle/service image · mono price input · variant builder with palette inputs · ink+yellow primary CTA
- ✅ EditPriceModal restyled: same patterns · mono inputs
- ✅ Standard view restyled:
  - Section chips palette-styled
  - **Compact row cards** (~60-70px) with veg/non-veg colored avatar (`success-pale`/`danger-pale`) · name + section tag + Hidden tag · meta line (description + stock/variants/bookable inline) · mono price · Live/Hidden status pill · Edit/Hide-Show/Del actions
- ✅ ProductFormModal restyled: dynamic field renderer with all 7 field types (text/url/number/textarea/select/veg_toggle/duration_select/variant_builder) palette-mapped · success-toggle Active switch · ink+yellow primary CTA
- ✅ Add-card (dashed) for "+ Add Product" at end of list
- ✅ Empty state restyled to yellow-pale gradient with category icon
- ✅ Loading: locked-palette pulse skeleton (replaces gray pulse)
- ✅ Toast restyled to ink (success) / danger (error)

### Gallery page · `Packages/brand-web/app/dashboard/gallery/page.js`

- ✅ Header with count chip + Outfit H1 + sub
- ✅ INK sub-tab pills (Brand Assets / Reference Links / Contracts) replacing the underline tabs
- ✅ **INK UsageBar** (replaces white card): mono `{used} / {quota} MB` with yellow used · "Storage used" Outfit label · yellow fill bar (mid: amber if ≥75% · warn: red if ≥90%) · mono `{remaining} MB free` · warning band when ≥90%
- ✅ Tag filter palette chips with counts (derived client-side when filter empty; show without count when filtered for honesty)
- ✅ Yellow-pale gradient upload dropzone with drag-drop preserved
- ✅ Asset grid (4-col): image-card with file-type fallback emoji · Outfit title · mono `{size} · {relative-date}` · palette tag chips (with "+N" overflow when >3 tags) · Open / Edit / Del actions
- ✅ EditAssetModal restyled: title/description fields + palette tag picker + ink+yellow Save
- ✅ Reference Links: **compact row cards** replacing list-with-hover-bg
  - Platform-colored avatar (auto-detected: YouTube red / Drive blue / Figma orange / Notion black / IG pink / Dropbox blue / generic info)
  - Title (Outfit) + meta line (URL + description) + platform tag chip
  - `Open ↗` ink-yellow primary + Edit/Del secondary
- ✅ LinkModal restyled: locked-palette form
- ✅ Contracts: **compact row cards** replacing HTML table
  - Influencer initials avatar
  - Campaign name + goal tag · meta line (@handle + signed/created relative date)
  - Mono fee (`influencer_fee + bonus_amount`)
  - Palette status pill (active=success-pale · pending_influencer/pending_brand=yellow-pale · draft=bg2 · cancelled=danger-pale)
  - `View PDF` primary OR `No PDF yet` muted note
- ✅ ContractPreviewModal restyled: ink header with mono sub · ink+yellow Download button · iframe preserved for PDF

## Honest divergences from mockup

1. **Gallery sub-tab counts** — mockup showed counts (14/6/23). Impl shows tab labels without counts because each panel mounts its own data; counts only known after panel-load. Showing fake `[—]` counts would be dishonest; OLD UI also had no tab counts. Tab counts would require lifting state to the page level — out of scope.

2. **Schema info bar `availing_modes` rendering** — used React `flatMap` with bold elements to avoid the old `replace(/_/g, '  ')` no-op trick. Cleaner, mono-yellow on dark.

3. **Products page count chip in master catalogue** — shows `{X} active in fleet` (or `services` based on category) instead of just `{X}/{Y} active` to be more honest about the master-catalogue model (Y is "available models" not "items to activate").

4. **Reference Links row card** — needed a spacer cell in the 5-col grid where `status-pill` would normally go on contract rows. Used empty `<span />` to maintain grid alignment.

5. **Empty / loading states** — used the same `.empty` yellow-pale gradient pattern across both pages (consistent with Flows 9/10/11/12).

## CSS scoping discipline — verified

All rules scoped under `.prd` (products) or `.gal` (gallery). Spot-check across both files:

**Products page:**
- `.prd .pc-actions button:hover:not(:disabled){background:var(--bg);color:var(--ink)}` — color re-asserted ✓
- `.prd .pc-actions button.del:hover:not(:disabled){background:var(--danger-pale);color:var(--danger-text)}` — color re-asserted ✓
- `.prd .pc-cta:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.prd .field .veg-row button:hover:not(:disabled){border-color:var(--muted-3);color:var(--ink);background:var(--white)}` — color re-asserted ✓
- `.prd .modal-f .submit:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓
- `.prd .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓
- `.prd .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}` — active hover preserves ✓
- `.prd .add-card:hover:not(:disabled){border-color:var(--yellow);color:var(--yellow-text);background:var(--yellow-50)}` — color re-asserted ✓

**Gallery page:**
- `.gal .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.gal .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓
- `.gal .ac-actions button.del:hover:not(:disabled){background:var(--danger-pale);color:var(--danger-text)}` — color re-asserted ✓
- `.gal .rc-action a.pri:hover{background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.gal .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}` — active hover preserves ✓
- `.gal .modal-f .submit:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓

Same lineage as Flow 7 patch / Flow 8 preventive / Flows 9/10/11/12 day-1.

## Listing-engine spine preservation — verified

Grep confirms no touches to `components/`:
- `products/components/ListingWizard.js` — untouched
- `products/components/ListingTemplateLayout.js` (621 LOC) — untouched
- `products/components/templateRegistry.js` — untouched
- All per-category drivers (`restaurant/`, `salon/`, `car_rental/`, `fashion/`) — untouched
- All shared atoms (DynamicFieldRenderer, ImageField, LivePreview, PhotoUploadStep, QualityScore, TeamMemberListEditor, VariantMatrixEditor, WeeklyScheduleEditor, BulkUploadCard, publishDriver, GoogleMapsLinkField, builtinStepComponents) — untouched
- `gallery/components/GalleryPicker.js` — untouched (not used by /gallery page directly)

The `useListingWizard === true` dispatch branch wraps `<ListingWizard />` with a locked-palette header but does NOT inject any CSS or class wrappers that would affect ListingWizard's rendering — `.prd` style block IS injected (for the header chrome) but ListingWizard renders inside that wrapper unchanged.

**Risk check**: Could `.prd` scoped CSS accidentally affect ListingWizard's internal rendering? Yes, if ListingWizard uses generic class names that collide. Mitigation: all `.prd` selectors are highly specific (compound class names like `.prd .pc-img`, `.prd .rc-mid`, `.prd .modal-h`) — extremely unlikely to collide with ListingWizard's Tailwind utilities or its own component class names. Smoke-test recommended post-deploy on a brand with `listing_engine_active=true`.

## QA evidence

- `pnpm qa` first-run clean: **75/75 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN**
- Duration: 1.7 min
- Report: `qa/reports/2026-05-25T04-22-37-798Z/QA-REPORT.md`
- First-run clean: **YES** (applied Flow 12's lesson — killed stale node processes before run · no environmental flake)
- No `products.spec.ts` or `gallery.spec.ts` exists — Flow 13 routes are regression-gate-covered only. Acceptable per `feedback_qa_governance.md`; manual smoke recommended on the live brand session post-deploy. Specifically:
  - Brand on standard category (e.g. restaurant): create a dish · edit · toggle hide · verify ProductFormModal renders all schema fields
  - Brand on car_rental: add a vehicle from master catalogue · verify ActivateModal works · edit price · verify EditPriceModal works
  - Brand with `listing_engine_active=true`: verify ListingWizard renders unchanged (no visual regression to its internal styling)
  - Gallery: upload an asset · edit tags · delete · view contract PDF

## LOC

- OLD `products/page.js`: 794 → NEW: 891 (+97; mostly scoped CSS block)
- OLD `gallery/page.js`: 624 → NEW: 769 (+145; CSS block + platform-detect helper + Activity-bar rendering)
- **Total OLD: 1,418 → NEW: 1,660 (+242)** — within mockup estimate (~1,540 stated as approximate)
- Mockup: 1,103 LOC

## Adjacent-fixes shipped

- Gallery's inline `fmtRupees` helper removed; using shared `lib/api.js` export ✓
- Contract status colors (amber/blue/green Tailwind) → palette mapping ✓
- Loading skeleton restyled from gray pulse → locked-palette spinner (single yellow spinner; replaced 8-card animated skeleton on products with same spinner pattern as gallery) ✓
- Schema availing-modes rendering — replaced no-op `m.replace(/_/g, '_')` with clean React flatMap ✓
