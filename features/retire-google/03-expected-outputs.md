# retire-google — expected outputs

Backend (`retire-google.test.js`):
1. `/follower/places/autocomplete`, `/follower/places/details`, `/follower/geocode`, `/places/resolve`, `/internal/geocode-maps-url`, `/internal/geocode-health`, `/internal/places-health` → 404.
2. No file under `backend/src` matches `geocoding.service`, `places.service`, `maps.googleapis.com` or a Google key name; the three files do not exist.
3. `GET /follower/reverse-geocode?lat=16.51&lng=80.65` → Vijayawada, Andhra Pradesh, km < 5; a point nearer Guntur → Guntur; the open sea → nulls; bad input → 422; `nearestCity(12.97, 77.59)` → Bengaluru.
4. A follower address typed with a listed city gets that city's centre; an unknown city with no pin → 422 on `city`; with a pin → 201.

Website: `next build` exit 0; `qa/web/brand/auth.spec.ts` passes; no reference to `geoApi`, `placesAutocomplete`, `placeDetails`, `geocode-maps-url`, `INDIAN_STATES`, `mapsUrl`, `referralCode` outside `app/admin`.

Regression: full backend run, 0 new failures against the 1386/1165/221 baseline.
