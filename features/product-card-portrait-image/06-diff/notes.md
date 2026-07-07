# Before / after — product card portrait image

## Before
- `ShelfProductCard` hero: `{ height: 104 }` on a 154-wide card = landscape
  box; `resizeMode="cover"` sliced tall portrait apparel photos (measured
  2:3–3:4) top and bottom → "half cut".

## After
- hero: `{ width: '100%', aspectRatio: 3/4, overflow: 'hidden', … }` = portrait
  box (~205px). Same `cover`. Portrait photos fill with negligible crop; pale
  bg shows for rare non-portrait sources.
- Brand guidance added: upload portrait 3:4 (1080×1440) for zero crop.

## Scope / safety
- Only the shared non-food product card; FoodDishCard + detail hero untouched.
- Style-only (no prop/import/logic change). esbuild JSX parse clean.
- Mobile → OTA; Maestro on-device verify owed (no device at build), to be
  confirmed by the founder's device session then flipped in the lock.

## Verification
- Live image dimensions measured (Adidas 494×741, Roadster 556×741 → portrait).
- Mockup 04-preview/mockups/card-fit.html shows before/after with the real image.
- pnpm qa GREEN gate 0.
