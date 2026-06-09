# Before / After — Follower Offers tab rebuild

Mockup: `04-preview/mockups/offers-comprehensive.html` (locked spec).
Screen: `Packages/Mobile/src/screens/follower/DealsScreen.js`.

## Before (old recolored screen)
- Header: "Offers" + generic subtitle "Creator-backed deals near you".
- **Brand-category tabs** (All / Dining / Shopping / Booking) — not in the mockup.
- Body: a flat 2-col grid of `ProductCard` from the old `getDeals` endpoint, plus a
  client-derived hero. Section-engine path existed but rendered the old tabs above it.

## After (rebuilt to mockup)
- Header: "Offers" + "📍 best deals in {city}" + 🔍 search.
- **Super-category chips** (All · Eat · Shop · Groom · Travel), sticky.
- **Sort/filter pills** (Best Discount · Ending Soon · By Creator).
- **All view:** hero "Today's Best Deal" (gradient, biggest live discount, "Grab →") +
  per-super-category deal rails (vibe `DealCard`).
- **Chip-filtered view:** 2-col grid (`NewOfferCard`) of that super-category, sorted.
- **By-Creator view:** offers grouped under each creator (gradient ring avatar + @handle +
  "N live deals" + View → to their store) with a deal rail each.
- Data: `GET /v1/follower/section/offers` (live, adapter-powered). 4-ID tracking preserved.

## Verification
- JSX/syntax: validated via the project Babel (`@babel/core` transform — clean).
- Data: the offers payload was verified live (`/v1/follower/section/offers` → 5 sections /
  11 items) prior to this rebuild.
- Visual: founder verifies on device after OTA (no emulator in the build environment).
  Maestro not run here → release uses GOVERNANCE_OVERRIDE (founder-side emulator is the
  standing pattern); founder is the visual acceptance gate on their phone.

## Residual / follow-ups
- "Near Me" sort deferred (offers carry no distance yet).
- Admin hero-PIN control (brand-web) deferred.
- Store-direct deals (no creator) are omitted from the By-Creator view by design.
