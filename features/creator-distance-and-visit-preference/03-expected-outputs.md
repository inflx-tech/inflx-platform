# creator-distance-and-visit-preference — expected outputs

Backend (`creator-distance-and-visit-preference.test.js`):
1. All 146 offered cities have coordinates; no unoffered city does; Vijayawada → Guntur is 25–40 km.
2. Discover for a Vijayawada brand: Vijayawada creator (0 km) → Guntur (25–40) → Hyderabad (240–300) → a creator with no city last with `distanceKm: null`; `within=50` and `within=state` keep the first two; `within=100` total 2; `sort=newest` still answers.
3. A brand with no main-branch city: `distanceKm` null on every row; `within=50` returns nothing.
4. Store Visit: never-saved creator → invitable anywhere; saved empty list → anywhere; picked Guntur → Hyderabad branch NOT_MATCHING, Guntur branch OK; Remote never city-bound.
5. Her settings read back with an empty visit list.

Mobile (jest): the meta line shows "32 km" / "Same city" / nothing for null; the filter sheet shows Nearest first selected and the four distance chips; "Within 50 km" sends `within=50`; the settings row shows the Anywhere wording when empty.

Regression: full backend run, 0 new failures against the 1386/1165/221 baseline.
