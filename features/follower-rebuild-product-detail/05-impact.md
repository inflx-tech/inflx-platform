# 05 — Impact: Product Detail rebuild

**Verdict: visual reskin of one screen. Zero data/logic change; all offer, variant,
CTA, and tracking behavior preserved.**

## Mechanics (`Packages/Mobile/src/screens/follower/ProductDetailScreen.js`)
- `productName` style: `serifDisplay` → `displayBold` (sans, 800, 24px).
- Rating JSX: single ★ + number → 5 star glyphs (★ filled to round(rating), ☆ rest)
  + review count.
- `sizeChip`/`sizeChipOn`/`sizeChipTxtOn`: bordered cream chip → full-width box,
  active = gold fill + ink (`C.onGold`) text.
- `hero` height 280 → 332; `priceFinal` 28 → 22.

## Blast radius
- Single screen, style + one JSX block. No props/contract/API change. Discount,
  creator note, multi-mode CTA, variants, add-ons untouched.
- Deploy-class: production-impacting (mobile OTA); no backend, no migration; inert to
  `pnpm qa`. released=false until founder device-verify.
- Risk: low — visual-only, no change to money math or CTA dispatch.
