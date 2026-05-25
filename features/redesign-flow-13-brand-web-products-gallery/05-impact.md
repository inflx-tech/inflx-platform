# Flow 13 · impact

**Terse verdict (chat):** zero functional / backend / logic / DB impact —
visual + UX only. 2-route bundle restyle; listing engine spine
(`products/components/`, ~5,500 LOC) preserved verbatim.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/products/page.js` | full rewrite (dispatcher only — components/ untouched) | ~794 → ~820 |
| `Packages/brand-web/app/dashboard/gallery/page.js` | full rewrite | ~624 → ~720 |
| `design/wave2/flow-13-brand-web-products-gallery/web.html` | new mockup | +1,103 |
| `features/redesign-flow-13-brand-web-products-gallery/01-spec.md` | new | +170 |
| `features/redesign-flow-13-brand-web-products-gallery/02-workflow.md` | new | +130 |
| `features/redesign-flow-13-brand-web-products-gallery/03-expected-outputs.md` | new | +110 |
| `features/redesign-flow-13-brand-web-products-gallery/04-preview/mockups/web.html` | new (mirror) | +1,103 |
| `features/redesign-flow-13-brand-web-products-gallery/04-preview/workflow-prediction.md` | new | +120 |
| `features/redesign-flow-13-brand-web-products-gallery/05-impact.md` | this file | +110 |
| `features/redesign-flow-13-brand-web-products-gallery/06-diff/notes.md` | new (post-impl) | +90 |
| `features/redesign-flow-13-brand-web-products-gallery/lock.json` | new | +40 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `backend/migrations/**` — zero changes
- `Packages/shared/**` — zero changes
- `Packages/Mobile/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes
- `Packages/brand-web/app/dashboard/layout.js` — zero changes
- `Packages/brand-web/app/dashboard/products/components/**` — **PRESERVED VERBATIM** (listing engine spine: templateRegistry, ListingTemplateLayout, per-category drivers for restaurant/salon/car_rental/fashion, all shared atoms)
- `Packages/brand-web/app/dashboard/gallery/components/GalleryPicker.js` — preserved (not used by /gallery page directly)
- `components/QuotaWallModal.js` — preserved (Window A's Phase A4 wall)
- All API call shapes (request bodies, query params, response field names) frozen
- All 13 endpoints + 1 upload helper preserved verbatim
- Form field names — frozen (especially `title`, `description`, `tags`, `url`)
- Route names — frozen
- localStorage / cookies — untouched
- Role gate — unchanged (brand auth required, handled by layout)
- Listing engine feature flag dispatcher — preserved verbatim

## What changes (UX + visual)

### Products page
- White schema-meta card → INK schema info bar (yellow accent + mono modes + ✦ catalogue badge)
- 6-color tier rainbow modal CTAs → ink+yellow palette CTAs
- Master catalogue gradient overlays preserved on image cards, restyled to mono price + palette Live/Hidden pills
- Segment tab buttons (dark gray) → palette chips with mono counts + segment-colored dots
- Standard product cards: grid → **compact row cards** (~60-70px) with veg/non-veg avatar + section tag + meta + mono price + status pill
- Loading skeleton: gray pulse → ink+yellow palette
- All 3 modals (ProductFormModal · ActivateModal · EditPriceModal) palette-restyled with Outfit headings, mono inputs, ink+yellow primary CTAs
- Veg toggle: red/green Tailwind buttons → success-pale/danger-pale palette buttons
- Variant builder: orange CTA → palette ink "+ Add Package"

### Gallery page
- Underline tabs (navy) → INK sub-tab pills with mono counts (Flow 11 pattern)
- White card UsageBar → **INK UsageBar** with mono numbers + yellow fill (red if ≥90%)
- Surface2 tag filter chips → palette chips with counts
- Generic dropzone → yellow-pale gradient dropzone
- Asset card: gray tag badges → palette tag chips · NEW: mono file size + relative upload date
- Reference Links: list-with-hover-bg → compact row cards with platform-colored avatars
- Contracts: HTML table → compact row cards (Flow 9 consistency) with mono fee + palette status pills
- Contract status colors (amber/blue/green Tailwind) → palette mapping
- PDF preview modal: navy header → ink+yellow palette with Outfit campaign title
- EditAssetModal · LinkModal: locked-palette form + ink+yellow Save buttons

### Cross-cutting
- All numbers / handles / dates / IDs / fees / file sizes / pcts → JetBrains Mono
- All hover/disabled CSS scoped under `.prd` (products) or `.gal` (gallery) with day-1 discipline
- 3 adjacent-fixes:
  - Gallery's inline `fmtRupees` helper duplicates `lib/api.js`'s — use shared one
  - Contract status colors (amber/blue/green Tailwind) → palette mapping
  - Loading skeletons restyle from gray pulse → locked-palette spinner

## Risks · mitigations

| Risk | Mitigation |
|---|---|
| Touching `components/*` accidentally breaks the listing engine spine | Hard rule: only `page.js` modified. ListingWizard pass-through block preserved verbatim. |
| CSS cascade collisions (Tailwind globals winning hover/disabled) | Apply scoping discipline from day 1 under `.prd` / `.gal`; every hover re-asserts color; every disabled locks bg + color |
| Master catalogue card image fallback (when `image_url` is null) | Use category emoji as fallback (preserved from OLD) |
| Reference link platform detection (when URL doesn't match known patterns) | Default to 🔗 generic icon + "Other" tag (preserved from OLD `iconForUrl` helper logic) |
| Contract pill color mapping for unknown status | Default to `status-pill.unknown` (bg2 + muted) |
| Tag chip overflow on asset cards with many tags | Limit display to first 3 tags; collapse the rest into `+N` overflow chip (Flow 10 pattern) |
| QuotaWallModal triggers from createProduct on Free plan | Preserved verbatim via `useQuotaWall` hook; both `setModal(null)` and modal-close handled |

## Time estimate

~3-4 hours focused work: 2 page rewrites (~75 min each) + run QA + manual smoke + diff notes + lock.json backfill.

## Deploy class

**production-impacting** — `git push origin main` triggers Vercel auto-deploy of brand-web. Web-only flow; no `Packages/Mobile/src/**` touched, so `release.maestro_green = "n/a"` per Flow 9/10/11/12 pattern. Surface for explicit go after `pnpm qa` 75/75 GREEN.
