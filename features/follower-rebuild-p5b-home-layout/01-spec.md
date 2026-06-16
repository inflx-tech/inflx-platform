# 01 — Spec: Phase 5b — Follower Home Layout Polish

**Contract:** `follower-rebuild-p5b-home-layout`
**Track:** Follower visual rebuild (Phase 5), step 2 (after 5a palette).
**Surface:** Follower mobile app only (OTA). No backend, no migration.
**Locked reference:** `04-preview/mockups/home-recolored.html` (founder's recolored
"INFLX Home-Creator" mockup — the Home screen, Screen 1).

## Goal
With the gold/cream palette already live (5a), bring the **structure** of the
follower Home to the locked recolored mockup: a proper hero/banner band and
cleaner carousels. Functional behavior is unchanged — this is layout + visual
fidelity, not new data or navigation.

## In scope
1. **Hero/banner** (`SectionRenderer.HeroOffer`): replace the flat gold box with
   the mockup's cream banner — terracotta `SALE/FEATURED` eyebrow, serif
   headline (discount or brand), **ink-on-gold** `SHOP NOW` button, optional
   limited-time circular badge. Renders only when an offers/mixed `hero` shelf is
   placed (admin-controlled); presence unchanged, styling matches mockup.
2. **ShelfHeader** (shared across all discovery screens): drop the colored TAG
   chip (`BRANDS/PRODUCTS/…`) and the count badge to match the cleaner locked
   mockup; rename "See all →" → "View all" in gold-deep. Title + View-all only.
3. **CategoryCircle**: rounded-square tile → true circular bubble (`.cat .bub`),
   neutral tint; active state stays gold.
4. **Trust band**: add the static "100% Authentic · Easy Returns · Secure
   Payment" cream strip as Home chrome (both section + fallback paths), per
   mockup `.trust`.
5. **Home white-on-gold sweep** (5a carry-over): `HomeScreenV2` search filter
   button text `#fff` → `onGold` (ink-on-gold).

## Out of scope (deferred — noted, not silently dropped)
- **Popular Near You** landscape business card (`.lcard`) and **Influencer Picks**
  "Curated by" 4-up grid block (`.picks`) — net-new card variants requiring a
  backend shelf-shape decision; they render functionally today as standard rails.
  Carried to a later 5/6 slice.
- Product/brand card fine-tuning (already palette-correct + structurally close).
- FindScreen / search restructure (deferred to its own flow per 2.5b).
- Fallback-feed restyle (safety net; retired during legacy-screen cleanup).

## Acceptance
- `pnpm qa` GREEN, gate 0 (mobile-only change, inert to web/db lanes).
- `cd Packages/brand-web && npm run build` exit 0 unaffected (no web change).
- Home renders hero banner (when a hero shelf is placed), clean shelf headers,
  circular category bubbles, trust band; no white-on-gold remnant on Home chrome.
- `released:false` until founder visual-verifies on device (joint verify gates the
  release flag for the whole 5→6 run).
