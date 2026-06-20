# Workflow — Follower v2 location flow

Step-gated build (each step green before the next, per founder's method).

## Wave A — OTA (reskin working screens onto `toing`)
- **L0 — Design tokens.** Add `toing` palette to `theme/tokens.js`
  (white canvas, yellow `#F5A623` + ink-on-yellow rule, deep-gold `#C77A00`
  for on-white, pink `#E11D6B`, semantics). _Test:_ import compiles; a sample
  Button/Input renders in the new palette.
- **L1 — Location entry / permission.** New screen: "Use current location"
  (primary yellow, ink text) fires permission+GPS; "Enter location manually"
  routes to L2. _Test:_ both actions behave; renders on device.
- **L2 — Select your location.** Reskin `LocationSearchScreen`: search pill,
  use-current + add-new pills, SAVED ADDRESSES (from `getAddresses`),
  RECENTLY SEARCHED. _Test:_ saved list loads from API; pick sets app location.
- **L3 — Search autocomplete.** Same screen, typed state: live predictions from
  the Places proxy; tap → `placeDetails` → set location. _Test:_ debounced
  predictions return; selection resolves coords.
- **L4 — Add new address.** Reskin `AddressScreen`: form, geocode-verify
  ("Located: …"), Save-as chips (Home/Work/Other), save. _Test:_ save persists
  via `addAddress` and appears in the saved list.

## Wave B — APK (later)
- **L5 — Map pin picker.** Install `react-native-maps`, enable Maps SDK for
  Android, add geo API key meta-tag; centre-pin + reverse-geocode-on-move +
  "Confirm & proceed"; "zoom in to place the pin" warning state. Native →
  new APK, not OTA. Maestro flow added before release flip.

## Flag
`follower-v2` flag toggles old vs new follower surfaces; live app stays on old
until the whole location slice is green.
