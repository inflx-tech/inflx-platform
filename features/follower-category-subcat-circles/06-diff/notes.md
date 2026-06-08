# Before / After — follower-category-subcat-circles

> "Before" = the Phase-2 pill chips (and the locked `category-comprehensive.html`
> pills). "After" = round-circle carousel (founder revision). Maestro/APK
> screenshot founder-side.

## What shipped (2 files)
- `components/vibe/CategoryCircle.js` — additive `active` prop (brown tile + brown
  label when selected).
- `screens/follower/CategoryListScreen.js` — sub-cat bar now renders a horizontal
  carousel of `CategoryCircle` (icon + label), active highlighted; sub-cats carry
  `{label, icon}` (icon from category accent; "All" = super-cat icon). Client-side
  filtering unchanged.

## Matches the (revised) design
- Round-circle sub-category carousel, consistent with Home's Browse-by-Category.
  Active = brown tile + brown label. Tap filters the brand/product shelves.

## Honest divergences
- Intentional deviation from the locked mockup (which used pills) — founder-requested.
- Sub-types are the real ones present in the payload; "All" uses the super-cat icon.
- Gradients/icons per Phase 0 conventions.

## Verification
- Babel transform via `module:@react-native/babel-preset`: **2/2 PASS**.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T06-35-00-971Z/`).
- `CategoryCircle.active` is additive → Home + other uses unaffected.

## Release
**production-impacting** (follower OTA). Founder-go cadence; Maestro founder-side
(recorded override). OTA: `pnpm publish-ota:follower` (v70 → next).
