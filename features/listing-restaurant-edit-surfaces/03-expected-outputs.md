# Expected Outputs — Restaurant edit surfaces

## Wave 1 (backend, shipped)
- `calculateQualityScore` selects `listing_data` and scores brand `field` rules from it.
- A restaurant whose `listing_data` has `restaurant_description`+`cuisines`+`hours_json`+
  `cover_image_url` etc. scores **> 0** (previously 0/100). `pnpm qa` GREEN, no regression.
- Gallery-photo rules count `listing_data.photos[]`; dish-photo `% ` rule counts products
  with `image_url` — no longer conflated.

## Wave 2 (brand-web, pending mockup-lock)
- After a failed save, the wizard shows a clear error (e.g. "account under review" /
  validation reason) and does NOT show "You're live"; `products_created` reflects only
  real saves.
- A pending brand can save profile + menu; that brand + its products do NOT appear in any
  follower feed/store until `users.status='approved'`; on approval they surface with no
  re-publish.
- Adding a dish: no stock photo pre-filled; owner is explicitly prompted to set price +
  add their own photo.
- Returning restaurant sees Manage Menu + Edit Profile doors; "Add dish" never re-asks
  Basics/Location/Hours.
- Pasting a Google Maps SHARE link (`maps.app.goo.gl/...`) resolves coordinates; area is
  a typed/confirmed field.

## Gate
- `pnpm qa` GREEN both waves; Wave 2 also mockup_locked + non-empty `06-diff/notes.md`.
- Deploys (Render backend / Vercel brand-web) classified production-impacting, explicit go.
