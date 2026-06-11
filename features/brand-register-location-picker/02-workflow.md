# Workflow — location capture at brand registration

1. New brand completes OTP → lands on the registration form (auth token present).
2. Location section defaults to **Search place**: types 3+ chars → debounced
   `GET /follower/places/autocomplete` → picks a suggestion →
   `GET /follower/places/details` → address line, city, state, pincode
   autofill (editable), lat/lng held in form state, "✓ Location captured" badge.
3. OR switches to **Google Maps link**: pastes any maps URL → "Locate" →
   `POST /internal/geocode-maps-url` → verified → same autofill path.
4. OR switches to **Manual**: types everything; no coords captured (badge absent).
5. Submit → `POST /brands/register` with the usual fields + optional
   latitude/longitude/locality/formatted_address (+google_maps_url for
   server-side re-resolution when link mode was used).
6. Backend stores lat+lng (discovery columns) AND latitude+longitude (legacy)
   + locality + formatted_address on the brands row.

Expected end state: a brand registered via search or link mode has non-null
`brands.lat/lng` immediately after registration; manual mode produces exactly
today's row shape. Distance-based follower discovery ranks the new brand
without any profile edit.
