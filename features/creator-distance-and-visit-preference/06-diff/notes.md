# creator-distance-and-visit-preference — before/after notes

**Before:** creator lists were ordered by reach (followers or subscribers). A brand in Vijayawada
saw a Hyderabad creator with 200k followers above a Guntur creator with 20k. Cities had names but
no position. For a Store Visit set, a creator who had never touched her invitation settings was
only pickable by a brand in her own city, because an empty visit list defaulted to that city.

**After (server):** each offered city carries its centre (migration 190, seeded from a CSV, no
Google). Discover, the set picker and add-to-group order nearest first from the brand's main
branch city, every row carrying `distance_km`; worked-with rows carry it too. `within=50|100|
state|any` narrows. The old sorts remain as choices. Rule 4 of eligibility: picked cities limit a
Store Visit to a branch in one of them; an empty list means anywhere; never-saved settings no
longer default to her own city.

**After (phones, D1–D3):** the meta line reads "Fashion · Guntur · 32 km" ("Same city" for 0);
the filter sheet opens on "Nearest first" and offers the four distance chips; her settings row
reads "Anywhere" with the explanatory line when empty.

_Phone details from the build report — see the build summary in `lock.json`._
