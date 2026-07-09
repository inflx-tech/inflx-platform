# Before/after — design-system-p1-product-card

## Before
- Three product-image aspects: rails 3:4, CategoryBrowser grid 122px landscape,
  SectionResults grid 110px landscape; cropper output 4:5. Nothing agreed →
  portrait photos sliced, and a careful crop got re-cropped by the card.

## After
- One aspect (3:4) everywhere. CategoryBrowser + SectionResults grids reskinned
  to the canonical card: 3:4 image, ink+yellow discount badge, brand (bold) /
  name (muted) / price (+ struck), 14px radius, hairline border, soft shadow —
  identical to ShelfProductCard.
- Cropper `product_photo` frame set to 3:4 (900×1200): crop-aspect ==
  display-aspect, so a crop shows exactly as set.

## Verification
- CategoryBrowser + SectionResults babel-parse; mobile tests 7/7; brand-web
  `next build` ✓; `pnpm qa` GREEN (79).
- On-device after-capture owed on the OTA (grids should look clean + consistent;
  re-cropped photo should display as set).

## Deploy
Mobile OTA (card reskin) + Vercel (cropper aspect). No backend.
