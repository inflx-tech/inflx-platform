# Impact — follower-location-switcher

**Verdict: adds a header location switcher + auto-detect; the feed follows the
chosen location. Backend = 1 migration + geocode-on-add + 1 read endpoint. Mobile =
LocationContext as the single location source + tappable header. Degrades safely.**

## Mechanics
- `LocationContext` becomes the feed's location source (Home + Category read it).
  `useCurrentLocation` = real GPS (runtime-3 APK) + reverse-geocoded label; saved
  addresses carry geocoded coords (migration 093 + createAddress geocode).
- No section-payload/contract change; the same `?lat&lng` already drives ranking.

## Risk
- **Low–moderate.** Mobile location plumbing changed on 2 screens; degrades to the
  default location on GPS/geocode failure (feed never blocked). Web QA unaffected.
  reverse-geocode is cached. Mitigation: babel/node-check + founder device smoke.
- Reversible: revert files; migration 093 is additive/nullable.

## Deploy
- **production-impacting**: Render backend + **migration 093** (founder go) +
  follower **OTA** (runtime 3). **No APK rebuild** (GPS native already in v75 APK).
  Surfaced for explicit go.
