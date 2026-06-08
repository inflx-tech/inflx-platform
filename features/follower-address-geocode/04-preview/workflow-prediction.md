# Workflow Prediction — follower-address-geocode

## Design
Founder decision: "best user-friendly using the available Geocoding API" (not the
separate Places API). So the Add-address form gains, on top of the existing fields:
- **📍 Use current location** (GPS → reverse-geocode → fills + locks coords),
- **🔎 Verify address** (forward-geocode → "✓ Located: {area}" / "Couldn't locate…"),
- **Save blocked** until the address resolves to coords (backend 422-enforced).

## What the reviewer should see
- Typing a real address + Verify → green "✓ Located: …". Save succeeds (address gets
  coords → repositions the feed when selected).
- Gibberish + Save → blocked with a clear message; nothing saved.
- "Use current location" → one-tap filled + locatable.

## Honest notes
- Geocoding API only (no Places Autocomplete / type-ahead dropdown — that needs the
  separate Places API). Verify is a button, not live-as-you-type.
- Current-location GPS needs the runtime-3 APK (already installed); else type+Verify.

## After-capture
Founder device smoke: add a real address (verify ✓ → saves) + a junk one (blocked).
