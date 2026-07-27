# Before / After — B1 step 1: bigger tiles + fluid grid

**Before (products/page.js `.prd`):** the grid was locked to **4 columns** (dropping to 3/2
at breakpoints), images were **120px**, and the product name was overlaid on the photo at
**13px, one line, truncated** — so tiles were small, names unreadable, and wide screens
showed gaps.

**After (CSS-only):**
- `.pc-grid` (flat + cols3) → `repeat(auto-fill, minmax(230px, 1fr))` — fluid, fills the
  screen, grows with the window (2-col on narrow).
- `.pc-img` 120px → **190px** (210px tall variant) — bigger tiles.
- `.pc-img .label` → **15px, 2-line clamp** (was 13px nowrap) + a stronger image gradient so
  the name stays readable over the photo.

## Changed
- `products/page.js` — 3 CSS rules in the `.prd` block. No JSX/logic change.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — Products page fills the width with bigger
  tiles and readable 2-line names.

## Known delta / deferred (later B1 steps)
- Name stays overlaid on the image (now bigger + 2-line), not moved fully below.
- One shared ProductCard + InventoryBrowse across the 3 product screens
  (products/page.js + listing/page.js + ListingTemplateLayout) and collapsing the 3 CSS
  systems are later steps. Backend parked.
