# Next round — agreed in chat, 19 Sep 2026 (for the founder's review before any build)

Everything below follows from today's decisions: city coordinates instead of Google, creators
ordered by distance, the Store Visit rule relaxed to the creator's own preference, and Google
APIs leaving the platform. Each item becomes its own contract with the usual lock.

| # | Item | What it delivers | Who sees a change | Screens to lock |
|---|---|---|---|---|
| 1 | **City coordinates** | One latitude/longitude per offered city (146), seeded from a CSV you can read, plus a distance function on the server. Nothing visible yet; the ground the next items stand on. | nobody | none |
| 2 | **Creators ordered by distance** | Every list of creators a brand sees (Discover, the set's picker, groups' add-creators) is ordered from the brand's main branch city outward, each row showing the distance ("Guntur · 32 km"); a filter for within 50 / 100 km / same state. | brand app | Discover row, set picker row, the distance filter |
| 3 | **Store Visit: her preference, not the branch city** | The block "her visit cities must include the branch's city" is removed. New rule: if she picked visit cities, she is selectable only for a branch in one of them; if she picked none, anyone anywhere may pick her. A creator whose picked cities do not include the branch city shows as not matching, as today; the change is that an empty list means anywhere. Her settings screen says in words what an empty list means. (Founder, 19 Sep: "if set then only those cities, if not allow any city".) | brand app (picker), creator app (settings wording) | picker warning, settings line |
| 4 | **Follower location without Google** | The follower app asks the phone for location once, the server picks the nearest of our cities, and the city picker is the fallback when she says no. Replaces Google reverse geocoding and place search in the follower app. The feed's distance criteria read city coordinates. | follower app (location sheet) | location sheet, picker fallback |
| 5 | **Website Google removal** | Registration on the website takes the same four-part address as the phones (place search and Maps-link box removed); the profile and listing pages lose the Maps-link resolver. | brand website | with the website re-skin, or on its own if you want it sooner |
| 6 | **Retire the Google key** | After 4 and 5: the Places and Geocoding services, their routes and the key are removed. Free Maps links ("Open in Maps") and device location stay. | nobody | none |

## Order proposed
1 → 2 → 3 in one push (they share the coordinates), then 4, then 5 and 6 together.

## Not in this round (noted so they are not lost)
- "I'm at the store now, use my location" pin on a branch — an exact pin without Google, later.
- Your phone walks of what shipped today: registration (C1–C8, B1–B9), pending access on the
  tabs, Change number (N0–N5), the redrawn Pending Verification row.
- Item 7 open question: return window 30 vs 7 days.
- The three practice brands' missing logo / about / contact person (no longer blocks approval).
