# Before / after — Listing Workspace UX

## What changed on screen

| | Before | After |
|---|---|---|
| Page width | `maxWidth: 960` centred (`listing/page.js:658`) — ~half a 1440–1920px screen unused | Fluid to 1720px; measured 1224px of a 1280px viewport in the running app |
| Navigation | Drill one level → whole view swaps; thin breadcrumb the only way back | Persistent `CategoryTree` rail; any category or item-type one click away, branch auto-expands to the selection |
| Add layout | Single narrow column; staged batch below the fold | Three panes — tree · wizard · sticky staging tray |
| Inventory | One-line rows (`.prow`) | Real table: photo, product + facets, brand, colour swatches, SKU, price, stock, status, actions |
| Bulk work | None — one row at a time | Multi-select + Hide / Show / Edit price / Remove |
| Inventory context | None | Stat tiles (products, live, low/out, avg price) + stock/brand filters |
| Header | Title + small pill tabs + full-width yellow setup slab | Title + vertical chip + search + actions; underline tab rail; slim setup strip |

## What deliberately did NOT change

Wizard steps ① Basics ② Variants/Photos ③ Details ④ Review, their validation
(`stepErrors` / `draftErrors`), `renderFacet`, SKU generation, the Excel import
path and all its error copy, crop-to-frame upload, tags, edit mode, and every
API call. All handlers were carried over untouched — the work is in the JSX
wrappers and CSS around them.

## Verification actually performed

- **`pnpm qa` → GREEN, 98 passed, gate 0** (2026-08-04, report
  `qa/reports/2026-08-04T13-31-33-611Z/QA-REPORT.md`). Same count as the
  pre-change baseline — zero regression.
- **JSX parse** clean on all three touched files via `next/dist/compiled/babel/parser`.
- **Next dev compile**: `✓ Compiled /dashboard/products/listing`,
  `GET /dashboard/products/listing 200` — the new component imports resolve and
  the route builds.
- **Live DOM check** at 1280px: `.page` = 1224px wide (was a fixed 960),
  `.ws` grid computed `236px 924px`, tree rail renders titled "Fashion
  catalogue", tab rail renders all three tabs,
  `document.scrollWidth === innerWidth` (no horizontal overflow).

## Verification NOT performed — and why

- **No authenticated screenshot of the populated screen.** The local run has no
  brand session or seeded fashion data, so the tree, table, staging tray and
  bulk bar could only be exercised structurally, not with real rows. The
  three-pane (leaf-selected) state and the bulk actions have **not** been run
  against real data.
- **No Playwright before/after image pair.** The "before" (mockup) renders, but
  the "after" needs the authenticated route; capturing it would require seeding
  a brand + fashion products.
- Both gaps land in the founder's single end-to-end pass, per the standing
  program rule that verification happens in one comprehensive walk rather than
  per slice. `release.released` stays `false` until then.

## Defect found while building (not introduced by this change) — now fixed

`getMyNodeProducts` (`backend/src/controllers/listing.controller.js`) filtered
`AND bp.is_active = true`, so **hidden products never came back from a category
browse** — the "Hidden" pill and the "Show" button in that path had always been
unreachable. The endpoint's own comment says "ALL statuses (live-first)", so the
filter contradicted the stated intent. It bit the new bulk Hide directly.

Carved as `features/backend-defect-inventory-hidden-products/` and **fixed on
founder go in the same push**: filter dropped, ordering now
`bp.is_active DESC, bp.created_at DESC NULLS LAST`. `InventoryBrowser` gained a
Live/Hidden visibility filter, and the caption that used to explain where a
hidden product had gone was removed — it described the bug.

This makes the push **backend + frontend**, not frontend-only as the original
impact note assumed.

Also pre-existing: this page's `<style>{CSS}</style>` block triggers a React
hydration warning in dev (the server escapes `'` in `font-family` to `&#x27;`,
the client does not), which makes React discard the SSR HTML for this route.
Present before this change, unrelated to it, left alone.
