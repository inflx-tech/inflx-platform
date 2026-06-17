# 06 — Before/After Diff Notes: Product Detail rebuild

Locked reference: `../04-preview/mockups/product-detail.html` (exact 1:1 of Creators
Vibe Yellow screen 03).

## Finding
`ProductDetailScreen` was already gold/cream + functionally complete. Faithful deltas
to the exact source applied:

## Implemented
- Title `serifDisplay` → `displayBold` (Jakarta sans-bold 800, 24px) — the font the
  founder flagged (source PDP title is sans-bold, not serif).
- Rating: single ★ + number → 5 star glyphs filled to value + "(N reviews)".
- Size selector: bordered cream chips → full-width boxes, active = gold fill + ink
  text (source `.sizebox.sel`).
- Hero height 280 → 332; price 28 → 22 (source proportions).

## Preserved (source omits as a single online brand — kept to avoid regression)
- Discount UI, creator-recommended note, per-vertical CTAs (Pay-at-Store/Book/Add-to-
  Cart), rupees, variant matrix, add-ons, more-from-brand.

## Noted limitations
- Colour kept as text chips (no colour-hex data for swatch circles).
- No carousel dots (one image per product today); no "Size Guide" link (no content).

## Verification
- `pnpm qa`: GREEN gate 0 (mobile change inert to web/backend).
- Before/after = device screenshot at founder verify (OTA).
