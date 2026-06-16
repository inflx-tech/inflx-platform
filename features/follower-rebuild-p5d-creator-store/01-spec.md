# 01 — Spec: Phase 5d — Creator Store Flow

**Contract:** `follower-rebuild-p5d-creator-store`
**Track:** Follower visual rebuild (Phase 5), step 4 (Creator Store).
**Surface:** Follower mobile only (OTA). No backend/DB/migration.
**Locked reference:** founder's recolored mockups (profile/creator-store screen);
layout baseline = `design/wave4-creator-vibe/creator-store-comprehensive.html`.

## Context (verified in code)
- `InfluencerStoreScreen` (Creator Store) is a bespoke screen driven by
  `followerApi.getStore(handle)` → `{ influencer, offers }`. It already uses the
  shared `ShelfHeader` (so it inherited 5b's cleaner header) and `ShelfProductCard`
  (palette-correct). The Follow/Share buttons were fixed to ink-on-gold in 5a.
- Its profile hero + collabs + category tabs + picks already match the
  comprehensive creator-store mockup. Palette is live from 5a/5b.

## In scope
1. `InfluencerStoreScreen`: category-tab active chip text `#fff` → `onGold` (ink) —
   the one remaining live white-on-gold remnant on this flow.

## Out of scope (deferred — noted)
- Profile-ring gradient (coral→orange story ring) — intentional, not a gold CTA.
- Any creator-store layout change — already matches the locked comprehensive mockup.

## Acceptance
- `pnpm qa` GREEN gate 0 (mobile-only, inert to web/db lanes).
- No white-on-gold remnant on the Creator Store surface.
- `released:false` until the joint 5→6 founder verify.
