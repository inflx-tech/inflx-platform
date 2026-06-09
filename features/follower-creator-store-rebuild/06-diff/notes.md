# Before / After — Follower Creator Store rebuild

Mockup: `04-preview/mockups/creator-store-comprehensive.html`.
Screen: `Packages/Mobile/src/screens/follower/InfluencerStoreScreen.js`.

## Before
- Ink hero (avatar + handle + 1-line counters + Follow), placeholder search bar.
- "Browse by category" 2-col grid + "Hot picks" vertical list.
- Section-engine fallback path gated by a flag.

## After (rebuilt to mockup)
- Top bar (← / ↗). Gradient-ring avatar, @handle ✓, role line, **3 counters**
  (followers / collabs / picks), **Follow + Share**, italic bio.
- **My Store Collabs** — distinct partner-brand circles → BrandStore.
- **Sticky category tabs** (verticals covered) → filter picks in place.
- **What {creator} Promotes** — vibe DealCard rail (filtered by tab).
- **Top Picks 🔥** — best by discount, ranked.
- Reels note.
- Data: `getStore(handle)`; 4-ID tracking preserved on every pick tap.

## Verification
- JSX/syntax: project Babel transform — clean. Tokens (verify/star) + fonts confirmed.
- Visual: founder verifies on device after OTA (no emulator in build env). Maestro waived
  via GOVERNANCE_OVERRIDE (founder-side emulator); founder is the on-device acceptance gate.

## Fix 2026-06-09 — show PRODUCTS, not one card per offer
First cut rendered one DealCard per offer (brand-level) → a creator's store showed e.g.
"Chaitanya Food Court · 10% off" instead of the 6 promoted products, and the tap had no
useful target (CI-snapshot offers carry offer_id=null). Fixed: "What Promotes" + "Top
Picks" now FLATTEN each offer's `products[]` into individual `ShelfProductCard`s (deduped
per product, best discount), showing product name + brand + discounted price. Tap → Product
Detail with the parent offer + 4-ID tracking + via_store_influencer_id (store-context).

## Residual / follow-ups
- Store-context purchase attribution (money slice) — separate.
- Admin Creator-Store template (brand-web) — follow-up.
- Business Page showing creator-coupon offers: by design those live in the CREATOR's
  store; the open business page shows the brand's own store-published offers. Surfacing a
  creator offer on the business page when entered VIA the creator (tracking context) is a
  possible enhancement.
