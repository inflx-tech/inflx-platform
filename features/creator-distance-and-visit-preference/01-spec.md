# creator-distance-and-visit-preference — spec

Founder, chat 19 Sep 2026 (items 1–3 of `Docs/NEXT_ROUND_2026-09-19.md`, "go and start
implementing in the order you recommended").

## What it delivers

1. **City coordinates.** One latitude/longitude per offered city (146), seeded from
   `backend/seeds/south_cities_coords.csv`. No Google service anywhere in the chain.
2. **Creators ordered by distance.** Every creator list a brand sees — Discover, the set's
   picker, a group's add-creators — is ordered from the brand's main branch city outward, each
   row showing the distance ("Guntur · 32 km", "Same city" for 0). A filter: within 50 km,
   within 100 km, same state, anywhere. The existing sorts (followers, engagement, newest) stay
   as choices; distance is the default when the brand has a city.
3. **Store Visit: her preference decides.** If a creator picked visit cities in her invitation
   settings, she is selectable for a Store Visit set only when the branch's city is one of
   them. If she picked none, any brand anywhere may pick her. The old default — an empty list
   meaning her own city — is withdrawn. Her settings screen says in words what an empty list
   means: *Anywhere — any brand can invite you for a store visit. Pick cities to limit it.*

## Rules

- Distance is between city centres (great-circle), rounded to the km. Two creators in the same
  city are 0 km apart; ties fall back to the existing follower order.
- A creator with no city, or a brand with no main-branch city, sorts last with no distance
  shown; the filter "anywhere" is the only one that includes them.
- Cities outside the six offered states have no coordinates yet; their creators sort last too.
- Nothing about the follower app changes here (item 4 of the round).

## Server

- Migration 190: `ref_cities.lat`, `ref_cities.lng`, seeded for the 146.
- `GET /brands/me/discover-creators` (and through it the set picker and add-to-group) rows
  gain `distance_km` (number or null); query `sort=distance` (default), `within=50|100|state|any`.
- `GET /brands/me/worked-with` rows gain `distance_km`.
- `collabEligibility` rule 4: empty visit list = anywhere; never-saved settings no longer
  default to her own city.

## Screens (mockups D1–D3)

D1 Discover row with the distance and the filter chips · D2 the set picker row (same) ·
D3 the creator's invitation settings "Cities you can visit" line with the anywhere wording.
