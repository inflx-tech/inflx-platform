# Impact — Follower location + distance

## Terse verdict
Additive location/distance layer. Backend distance degrades gracefully (no follower
coords → existing city soft-boost; no brand coords → NULLS LAST). Mobile adds a
permission prompt + GPS + "X km away" + area name. No money/auth change.

## Blast radius
- Layer 1: `updateMe` + new `geocoding.service` (refactor of existing controller logic
  — keep the endpoint behaviour identical). Writes canonical `lat/lng` (+ keep
  latitude/longitude synced). Backfill is a one-time prod data update.
- Layer 2: migration 090 (additive follower columns) + 1 new authed endpoint.
- Layer 3: distance added to 2 listing rules behind "has coords" guards — no change
  when coords absent.
- Layer 4: mobile cards + header; OTA. UI-governed (mockup-lock + 06-diff).

## Risk / rollback
- Revert per layer. Geocode/permission failures never block the feed (city fallback).
- Cost: only Geocoding API (low volume — per brand save + per follower session); no
  Distance Matrix.

## Open decisions for the next window
- Reconcile the duplicate lat/lng vs latitude/longitude columns (recommend: write
  both; read lat/lng; later drop latitude/longitude in its own migration).
- How often to refresh follower location (on app open vs on a "near me" pull).
