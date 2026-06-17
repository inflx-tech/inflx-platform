# 01 — Spec: Follower rebuild — Product Detail

**Contract:** `follower-rebuild-product-detail` · shopping-journey sequence.
**Locked reference:** EXACT 1:1 reproduction of founder's `CREATORS VIBE Yellow
-standalone- (1).html` screen 03 → `04-preview/mockups/product-detail.html`.
**Founder:** 'ok lock it' 2026-06-16.

## Finding (verify-first)
`ProductDetailScreen` is already gold/cream + functionally complete (hero + back +
♡/share, discount price with struck MRP + savings, creator note, colour/size
selectors, description, more-from-brand, sticky multi-mode CTA). The exact-source
deltas are focused + visual.

## Scope (faithful to the locked source)
- **Title** `serifDisplay` → Jakarta **bold** (`displayBold`, weight 800, 24px) —
  the divergence founder flagged (source PDP h2 is sans-bold, not serif).
- **Rating** → render 5 star glyphs filled to the rating (was single ★ + number).
- **Size selector** → full-width boxes, **gold fill + ink text when active**
  (source `.sizebox.sel`); was bordered chips with gold-text-on-cream.
- **Hero** height 280 → 332; **price** 28 → 22 to match source proportions.

## Preserved (NOT stripped — source omits them as a single online brand)
- Discount UI (sale badge + struck MRP + "You save").
- Creator-recommended note (commission/credit hook).
- Per-vertical CTAs (Pay-at-Store / Book / Add-to-Cart by availing-mode) — stripping
  to a single ADD TO CART would break restaurant/salon/car.
- Rupees (not $), real product data, variant matrix, add-ons, more-from-brand.

## Out of scope / noted
- Colour kept as text chips (no colour-hex data → can't fabricate swatch circles).
- Carousel dots only meaningful with multiple images (products carry one today).
- "Size Guide" link omitted (no content to link).

## Acceptance
- Title sans-bold; 5-star rating; gold-filled size boxes; hero/price proportions.
- `pnpm qa` GREEN gate 0 (mobile change, inert to web/backend tests).
- released=false until founder device-verify.
