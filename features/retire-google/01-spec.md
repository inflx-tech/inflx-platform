# retire-google — spec (items 5 and 6 of `Docs/NEXT_ROUND_2026-09-19.md`)

Founder, 20 Sep 2026: "go to 5 and 6". Item 4 (the follower app's own location sheet) is
deferred by the founder to the follower-app redesign; the server half of it lands here so the
key can go now.

## What it delivers

1. **Website (item 5).** Registration on the brand website takes the same four-part address as
   the phones — street, pincode, state, nearest major city — from the offered list. The place
   search, the Maps-link box, coordinate capture and the referral code box are removed. The
   profile page's main-branch address becomes the same four parts; its Maps-link field goes.
   The listing wizard's Maps-link field (restaurant era) becomes a plain text box.
2. **Server (item 6).** The Places and Geocoding services, their proxy routes
   (`/follower/places/*`, `/follower/geocode`, `/internal/geocode-*`, `/internal/places-health`)
   and every reference to a Google key are removed. Cities are never added at runtime.
3. **"Where am I" without Google.** `GET /follower/reverse-geocode?lat&lng`, which the live
   follower app calls on cold start, now answers with the nearest offered city from our own
   coordinates (migration 190): `{ area_name, city, city_id, state, km }`, null when the point is
   more than 300 km from every offered city. Follower home sections and the follower's stored
   location use the same. A follower address typed without a pin takes the typed city's centre;
   an unknown city with no pin is refused.

## What stays
Free Maps links ("Open in Maps"), the phone's own location service, `ref_state_aliases` (typed
state names from older bundles and the website), `ref_unknown_states` (table only; nothing
writes it now).

## What the founder must do after the push
Remove `GOOGLE_PLACES_API_KEY` and `GOOGLE_GEOCODING_API_KEY` from Render's environment (and
from any local `.env`); nothing reads them any more. Optionally disable the key in the Google
console.

## Out of scope
The follower app's location sheet and its client calls to the retired routes (dead code today:
no live follower screen renders the sheet; item 4 replaces it at the redesign).
