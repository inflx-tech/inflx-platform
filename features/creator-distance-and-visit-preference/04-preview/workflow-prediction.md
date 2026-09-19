# creator-distance-and-visit-preference — workflow prediction

Mockups: `mockups/creator-distance-mockups-v1.html` (D1–D3, drawn from the founder-approved list, built on the go of 19 Sep).

| Screen | Predicted | Built as |
|---|---|---|
| D1 Discover, nearest first | distance after the city on each row; "Same city"; nothing when unknown; no-city creators last | `DiscoverList` `CreatorCard` / `MemberRow` meta line from `distanceKm` |
| D2 the filter | "Nearest first" default sort; Within 50 / 100 km, Same state, Anywhere chips | `FiltersSheet` + `copy3` sorts/distance rows → `sort`, `within` |
| D3 her preference | "Cities you can visit · Anywhere" + the explanatory line when empty | `InvitationSettingsScreen` row value + hint |

Deliberate departures: none.
