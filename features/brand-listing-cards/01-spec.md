# Feature Spec — Brand listing: bigger tiles + fluid grid (B1 step 1)

> Step 2. First, safe listing slice. Directly fixes the founder's complaints —
> "small names, small product tiles, screen not covered" — on the main products
> grid, via contained CSS. The full one-card-system merge is a later step.

## Problem / goal
The products grid (`products/page.js`, `.prd` scoped CSS) locks a **4-column** grid, uses
**120px** images, and overlays the product **name on the photo, truncated to one line** —
so tiles are small, names unreadable, and wide screens show gaps. Make the grid **fluid**
(fills the screen), the images **bigger**, and the names **bigger + 2 lines**.

## Scope
**In scope (CSS-only, `.prd` block in products/page.js)**
- `.pc-grid` (both flat + cols3 variants) → `repeat(auto-fill, minmax(230px, 1fr))` (fluid,
  grows with the window; 2-col on narrow) — replaces the fixed 4/3/2-col rules.
- `.pc-img` height 120px → ~190px (bigger tiles).
- `.pc-img .label` (name) → ~15px, **2-line clamp** (was 13px nowrap ellipsis) + a stronger
  image gradient so it stays readable.

**Explicitly out of scope (later B1 steps)**
- Moving the name fully below the image; one shared `<ProductCard>` + `<InventoryBrowse>`
  across the 3 product screens; collapsing the 3 CSS systems; the listing/page.js +
  ListingTemplateLayout consolidation. Backend.

## Surfaces touched
- App: brand-web only (products/page.js CSS). Roles: brand.

## Data / contracts
- None. Pure styling of the existing grid.

## Non-functional
- CSS-only — no JSX/logic change; the card structure + actions are untouched.

## Design reference
`04-preview/mockups/listing-shell.html` — bigger cards, fluid grid, readable names.
