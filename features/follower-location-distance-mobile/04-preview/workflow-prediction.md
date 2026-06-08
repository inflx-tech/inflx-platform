# Workflow Prediction — follower-location-distance-mobile (Contract 2)

## Design source
The agreed mockups show distance on discovery cards (e.g.
`home-comprehensive.html` brand card "★ 4.5 · 1.2 km"; `category-comprehensive.html`
list rows "· 1.2 km") and the area at the top of Home. Contract 2 renders the
**distance** half (rating stays omitted — no data) plus the **area name** header.

## What the reviewer should see
- Brand / product / business-list cards show a "📍 X km away" line when the backend
  returned `distance_km` (nearest-first order).
- Home header shows the reverse-geocoded area for a logged-in follower.

## Honest notes
- Distance shows only when present (brands without coords show none).
- Coords are the selected/default location today (Vijayawada); auto device-GPS =
  Contract 3 / next APK. Currently *Aveen food paradise* has real coords (backfilled)
  so it shows a real distance; other brands show none until their coords are set.
- Offer/deal cards don't show distance yet (offer rules don't compute it).

## After-capture
Maestro/APK screenshots of Home + Category (founder-side) per
`location.maestro-flow.json`.
