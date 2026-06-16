# Expected outputs — Phase 5a (palette foundation)

## Automated
1. `pnpm qa` → GREEN gate 0, zero regression (mobile-only token/style change).
2. Mobile bundle builds for OTA.

## Behavioural (after OTA, verify on Home)
3. Home reads gold primary + cream/white surfaces + ink text + serif hero; sale badges terracotta.
4. Gold buttons/badges carry INK text (no white-on-gold) on: hero, Reels FAB, rank badges,
   story follow, product-detail primary CTA, creator follow.
5. No layout regressions (this step is color only).

## Non-goals
- Home layout to mockup (5b). Non-Home per-screen CTA/chip sweeps (their flows). 2.5c cleanup (later).
