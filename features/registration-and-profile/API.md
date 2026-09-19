# registration-and-profile — the API the screens are built against

Built 18 Sep 2026 (backend phase 1–2). Every path is under `/v1`. Envelope: `{ success, data }` /
`{ success:false, error:{ code, message, field, details } }`.

## Reference lists
- `GET /reference/states?offered=1` → `{ items: [{ id, name, sort, cities: [{ id, name, sort }] }] }` —
  only the six southern states and their 146 offered cities, in seed order. Without the flag, every
  state and city (matching and display keep using that).
- `GET /reference/languages` → 30 items `{ code, label, sort }`, English → Hindi → southern → rest.
- `GET /reference/creator-niches` → 21 items, `other` last (`{ code:'other', label:'Other' }`).
- `GET /reference/brand-categories` unchanged.

## Registration
- `POST /brands/register` body: `{ name, business_name, sub_categories:[...], address_line, pincode,
  state_id, city_id }`. `category` optional (defaults to fashion). Ignored if sent: latitude,
  longitude, locality, formatted_address, google_maps_url, referral_code, gstin. Errors: 422 with
  `field` ∈ business_name | sub_categories | name | address_line | pincode | city_id
  (`details.fields[0].code === 'CITY_REQUIRED'` when the pair does not resolve).
  201 → `{ brand, user_status:'pending', completeness }`.
- `POST /influencers/register` body: `{ name, state_id, city_id, instagram_handle?, youtube_handle? }`
  (at least one handle). 201 → `{ influencer, user_status:'pending', completeness, claim }`.

## Own profile
- `GET /brands/me` → `{ brand, user_status, branches, mainCity, needsSubCategories, needsMainCity,
  completeness, submitted_for_review_at }`. `brand` carries `email`, `gstin`, `bank_ifsc`,
  `has_bank_account` (never the number), `login_phone` (= `phone`), `rejection_reason`,
  `contact_person`, `about`, `logo_url`, `sub_categories`, `address_line`, `pincode`, `city`, `state`.
  `business_phone` is gone.
- `PATCH /brands/me` accepts: `business_name, about (≤200), contact_person, email, sub_categories,
  logo_asset_id, gstin, website_url, instagram_handle, bank_account_no + bank_ifsc (both or neither;
  `BANK_PAIR` 422 otherwise; both '' clears), address_line, pincode, state_id, city_id` (any of the
  four rewrites the MAIN branch; the users row's city/state follow). Coordinates/Google fields are
  ignored. Response `{ brand, completeness }`.
- `GET /influencers/me` → `{ influencer, user_status, completeness, submitted_for_review_at,
  rejection_reason }`. `influencer` carries `full_name, bio, niche:[code], niche_other, language:[codes],
  age, gender ('female'|'male'|'other'), email, city_id, city_name, state_id, state_name,
  instagram_handle, youtube_handle, profile_image_url, has_upi, has_bank_account, bank_ifsc, has_pan,
  phone, needsNiche`.
- `PATCH /influencers/me` accepts: `full_name, bio (≤150), niche:['code'] (+ niche_other when
  'other', ≤80 chars, `NICHE_OTHER_REQUIRED`), language:[codes from the 30] (`LANGUAGE_UNKNOWN`),
  age (13–99, `AGE_INVALID`), gender (`GENDER_INVALID`), email (`EMAIL_INVALID`), state_id + city_id
  (`CITY_REQUIRED`), instagram_handle, youtube_handle, profile_image_key, upi_id, bank_account_no,
  bank_ifsc, pan_number`. `place_id` is ignored; a bare typed `city` is refused. Response
  `{ influencer, social, completeness }`.

## Completeness (the same object everywhere)
`{ total:10, done, complete:boolean, missing:[keys], missing_labels:[words] }`.
Creator keys: full_name, state, city, handle, photo, bio, niche, language, age, gender.
Brand keys: contact_name, business_name, sub_categories, address_line, pincode, state, city, logo,
about, contact_person. Labels are the words to show ("photo", "nearest major city", "what you sell"…).

## Submit for review
- `POST /brands/me/submit-for-review`, `POST /influencers/me/submit-for-review` (no body).
  422 `PROFILE_INCOMPLETE` with `details.missing_labels` when incomplete. 409 when already approved
  or suspended. 200 → `{ user_status:'pending', submitted:true, message }`. From `rejected` it
  clears the remarks and moves the account back to `pending` — this IS the resubmit.
- `POST /brands/resubmit` = the same, only from rejected.

## Pending gate
Every creator action (invitations accept/decline, counters, sign, pitches, shoot, find-brands,
withdrawals, posting) answers `403 { code:'ACCOUNT_PENDING', message:'Your account is under review
by admin. This feature will be available once approved (usually within 24 hours).' }` for a pending
creator, and `ACCOUNT_REJECTED` for a rejected one. Reads of `/influencers/me*`, `/brands/me*`,
wallet/earnings, reference lists, invitation settings and social stay open.

## Branches (brand)
- `GET /brands/me/branches` → `{ branches:[{ id, name, formattedAddress, pincode, cityId, cityName,
  stateId, stateName, isMain }] }` (lat/lng/googlePlaceId now always null).
- `POST /brands/me/branches` `{ name, address_text, pincode, state_id, city_id, is_main? }`.
  When the brand already has exactly ONE branch, `is_main` (true/false) is REQUIRED —
  422 field `is_main`, code `MAIN_CHOICE_REQUIRED`. First branch is always main.
- `PUT /brands/me/branches/:id` any of the same fields; `is_main:true` makes it main.
- `POST /brands/me/branches/:id/make-main`, `DELETE /brands/me/branches/:id` unchanged.
- `POST /places/resolve` is GONE (404).

## Admin
- `GET /brands/:id` (admin) → `{ brand, completeness, missing_fields:[labels], branches,
  submitted_for_review_at }`.
- `GET /influencers/:id` (admin) → the record plus `completeness`, `missing_fields`, `niche_other`,
  `niche_other_resolved_at`, `email`, `submitted_for_review_at`, `has_pan`, `has_bank_account`,
  `has_upi`, `age`, `gender`, `bio`, `profile_image_url`.
- `GET /admin/queue/brands`, `GET /admin/queue/influencers` rows gain `missing_count`,
  `missing_fields`, `submitted_for_review_at` (submitted rows first).
- `PATCH /admin/brands/:id/status { status:'approved' }` and
  `POST /admin/creator-verifications/:id/verify` → 422 `PROFILE_INCOMPLETE` (message names the
  missing items; `details.missing_labels`) when the profile is incomplete.
- `GET /admin/niches/other` → `{ items:[{ influencer_id, full_name, instagram_handle, youtube_handle,
  niche_other, created_at, city_name, state_name, user_status }], niches:[{ code, label }] }`.
- `POST /admin/niches/other/:influencerId/map { code }` → `{ influencer_id, niche:[code], was }`.
- `POST /admin/niches { label, code?, influencer_id? }` → 201 `{ niche:{ code, label, sort },
  mapped? }`; 409 when the code or label already exists. Capability: `approvals`.
