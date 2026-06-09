# Workflow — Follower Offers tab rebuild

## Actors
- **Follower** (mobile, logged-out or in): opens the Offers tab.
- **System**: `DealsScreen` fetches the live offer shelves and renders the mockup views.

## Flow
1. Tab mount → `followerApi.getOffersSections()` → `GET /v1/follower/section/offers`
   → `{ sections:[…] }` (adapter-powered: assignment + showcase + store-direct offers).
2. `DealsScreen` flattens every `offers`/`mixed` shelf's items into one deduped offer list.
3. Render chrome: header ("Offers · 📍 best deals in {city}"), sticky super-category chips,
   sort/filter pills. Default state: chip="all", sort="discount".
4. Body by state:
   - **all + (discount|ending):** hero = top offer by current sort; then per-super-category
     rails (Eat/Shop/Groom/Travel/More), cards = vibe `DealCard`.
   - **chip ≠ all:** offers in that super-category → 2-col grid (`NewOfferCard`), sorted.
   - **sort = creator:** group offers by `via_creator` → creator header + deal rail each
     (store-direct, creator-less offers omitted from this view).
5. Tap a deal → `ProductDetail` with the offer + brand + creator + **4-ID tracking**
   passed straight through. Tap a creator → `InfluencerStore`.
6. Pull-to-refresh re-fetches. Empty/again-empty → empty state (never throws).

## Expected end state
The Offers tab matches `offers-comprehensive.html`: hero + category rails by default,
filterable by super-category, sortable, and groupable by creator — over the real offers
that are already live. Attribution chain intact on every tap.

## Verification
- Syntax: project Babel transform (clean).
- Data: `/v1/follower/section/offers` verified live (5 sections / 11 items).
- Visual + interaction: founder on device after OTA (no emulator in build env).
