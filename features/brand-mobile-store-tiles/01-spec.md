# Feature Spec — Store preview tile polish (B2-lite)

> B2 reduced per the locked scope: listing/product management is web-only BY DESIGN,
> so the mobile store stays read-only. Only the cramped tiles are fixed.

## Problem / goal
The mobile store preview used `48.5%` cards with **96px images** and **11.5px names** on a
`minHeight:30` two-line clamp — the same cramped look we fixed on web listing.

## Scope
**In scope:** image 96 → **150px**, name 11.5 → **13.5px** with lineHeight 18 / minHeight 36
(the existing `numberOfLines={2}` now has room), price 12.5 → 14px, padding/emoji nudged.
**Out of scope:** adding product management to mobile — listing is web-only by design.

## Surfaces touched
- Mobile (brand) only — OTA. Styles only; no data/behaviour change.
