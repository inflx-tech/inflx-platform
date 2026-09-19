# creator-distance-and-visit-preference — workflow

## Actor
An approved brand in Vijayawada picking creators; a creator in Guntur setting her invitation preferences.

## Steps
1. Brand opens Creators → list ordered nearest first: Vijayawada creators ("Same city"), then Guntur ("32 km"), then Eluru, …; a creator with no city last, no distance.
2. Brand opens Filters → "Nearest first" selected; taps "Within 50 km" → Apply → only Vijayawada and Guntur creators remain.
3. Brand opens a Store Visit set's picker → the same order and distances; a creator who picked visit cities that do not include Vijayawada shows as not matching; a creator with no cities picked is pickable.
4. Creator opens Invitation settings → "Cities you can visit · Anywhere" with the explanatory line; picks Guntur → summary "1 city in 1 state"; a Hyderabad brand's Store Visit set now shows her as not matching, a Guntur brand's does.

## Success definition
`ref_cities.lat/lng` set for all 146 offered cities; `distance_km` on every discover / picker / worked-with row; default sort by distance; `within` filter honoured; empty visit list = anywhere on the server and in words on the screen.

## Build order
1. Migration 190 + `run-190.js` (coordinates from `south_cities_coords.csv`).
2. `discovery.service`: home CTE, `distance_km`, `within`, default sort; `distanceForCreators` for worked-with.
3. `collabEligibility`: rule 4 empty = anywhere; never-saved default = `[]`.
4. `backend/tests/creator-distance-and-visit-preference.test.js`.
5. Phones: DiscoverList meta line, FiltersSheet sort + distance chips, InvitationSettings wording.
6. Deploy on the founder's go: run-190 → commit → push → OTA brand → OTA influencer.
