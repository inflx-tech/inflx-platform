# Before / after — product detail hero fit

## Before
- `hero: { height: 332 }` (near-square, full width) + `resizeMode="cover"` →
  portrait product photo (2:3) sliced ~104px top + ~104px bottom (head/feet).

## After
- `hero: { width: '100%', aspectRatio: 3/4, overflow: 'hidden' }` (portrait)
  + hero image `resizeMode="contain"` → whole photo shown; pale accent bg
  fills any letterbox margin. Carousel paging (HERO_W) unchanged.

## Scope / safety
- Only the detail-screen hero carousel image; card, food, and "more products"
  thumbnails untouched. Style/prop-only (no logic/data/nav change).
- esbuild JSX parse clean.
- Mobile → OTA; Maestro on-device verify owed (no device at build), confirmed
  on the founder's device with the owed v180+ batch.

## Verification
- Cause reproduced from the founder's screenshot (head cropped) + measured
  image dims (494×741 portrait) against the 332px near-square hero.
- Mockup 04-preview/mockups/detail-hero.html shows before/after with the real image.
- pnpm qa GREEN gate 0.
