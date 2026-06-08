# Workflow Prediction — follower-location-switcher

## Design source
Swiggy-style location switcher (already designed + built as `LocationSheet` +
`LocationHeader`, Path C-1). This contract activates it for the rebuilt Home +
Category and makes it real (GPS + geocoded addresses). No new visual language.

## What the reviewer should see
- Header location is tappable (▾). Tapping opens a bottom sheet:
  **📍 Use current location** · **＋ Add new address** · **SAVED ADDRESSES** list.
- Picking any option closes the sheet and the feed re-ranks to that area; the
  header label updates.
- Cold start: the header shows the auto-detected area (real GPS on the new APK).

## Honest notes
- Real GPS requires the runtime-3 APK (already built/installed); on older builds /
  web / denied permission it falls back to the default location (Vijayawada).
- Address coords come from live forward-geocoding on save (billing now active).
- "Add new address" routes to the existing AddressScreen.

## After-capture
Founder device smoke: tap header → switch to a saved/added area → confirm the feed
distances + content change. Recorded at release.
