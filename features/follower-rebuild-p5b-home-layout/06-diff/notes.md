# 06 — Before/After Diff Notes: Phase 5b Home Layout

Locked reference: `../04-preview/mockups/home-recolored.html` (Screen 1 — Home).
Capture mode: device/OTA (RN), reviewed against the mockup at the joint 5→6 verify.

## Changes implemented
- **Hero banner** (`SectionRenderer.HeroOffer`): before = flat gold rectangle with
  small text; after = cream banner, terracotta eyebrow, serif headline, ink-on-gold
  `SHOP NOW` pill, limited-time circular badge. Matches `.banner`.
- **ShelfHeader** (`vibe/ShelfHeader.js`): before = serif title + colored TAG chip
  (BRANDS/PRODUCTS) + count pill + "See all →"; after = title + "View all"
  (gold-deep) only. Matches `.sechead`. Tag/count branches removed.
- **CategoryCircle** (`vibe/CategoryCircle.js`): before = white rounded-square tile
  (radius 20, bordered); after = neutral circular bubble (radius 30). Matches `.bub`.
- **Trust band** (`HomeScreenV2.js`): added static cream strip — 100% Authentic ·
  Easy Returns · Secure Payment, gold-deep glyphs. Matches `.trust`.
- **White-on-gold sweep**: `HomeScreenV2` `filterTxt` `#fff` → `C.onGold`.

## Verification
- `pnpm qa`: GREEN, gate 0 (recorded at implementation).
- `node --check` / RN bundle: clean (no syntax/import errors).
- Mobile-only; web build unaffected; no migration.

## Deferred (tracked)
- Popular-Near-You landscape card + Influencer-Picks "Curated by" grid (net-new
  card variants) → later 5/6 slice.
