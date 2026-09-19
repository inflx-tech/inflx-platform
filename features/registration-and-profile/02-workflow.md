# registration-and-profile — workflow

Build order. Each phase is proved before the next starts. The spec (`01-spec.md`) and the locked
mockups (`04-preview/mockups/registration-and-profile-mockups-v1.html`, C1–C8, B1–B9, A1–A3) are
the only sources.

## Phase 1 — the lists (migration 188 + reference endpoint)
1. `ref_states.is_offered`, `ref_cities.is_offered` — six states and exactly the 146 district
   headquarters from `backend/seeds/south_cities_draft.csv` flagged; rows matched by state name +
   `name_norm`, missing ones inserted with `source='seed'`; nothing deleted.
2. `ref_languages` — 20 new codes from `languages_draft.csv`, all 30 re-sorted to the CSV order;
   the 10 existing codes untouched.
3. `ref_creator_niches` gains `other` (sort 999) so the existing niche validation accepts it.
4. `influencers`: `state_id`, `email`, `niche_other`, `niche_other_resolved_at`,
   `submitted_for_review_at`. `brands`: `email`, `bank_account_no` (encrypted), `bank_ifsc`,
   `submitted_for_review_at`. Backfill `influencers.state_id` from `city_id`; existing pending
   accounts get `submitted_for_review_at = created_at` so nobody already in the queue falls out.
5. `GET /v1/reference/states?offered=1` returns only offered states, each with only its offered
   cities, in seed order. Without the flag the endpoint is unchanged.
6. `backend/scripts/run-188.js --dry | --apply` with the row-count checks (6 offered states, 146
   offered cities, 30 languages, 21 niches).

## Phase 2 — the server
7. `POST /brands/register` takes name, business_name, sub_categories, address_line, pincode,
   `state_id`, `city_id`; ignores latitude/longitude/locality/formatted_address/google_maps_url/
   referral_code; writes `users.city/state` from the reference rows and creates the main branch
   with `city_id`/`state_id`. A typed `city`/`state` pair is still resolved against the list for
   one OTA generation, and refused (`CITY_REQUIRED`) if it does not resolve.
8. `POST /influencers/register` requires `state_id` + `city_id`; writes `city_id`, `state_id`,
   the two names, and `users.city/state`.
9. `PATCH /influencers/me` gains `state_id`, `city_id`, `age`, `gender`, `email`, `niche_other`;
   `language` is validated against `ref_languages`; `place_id` is gone. `PATCH /brands/me` gains
   `email`, `state_id`, `city_id` (with `address_line`/`pincode`, they rewrite the main branch),
   `bank_account_no` + `bank_ifsc` (one entry, both or neither); loses the coordinate and Google
   fields from its whitelist.
10. `completeness.service.js` — one function per side returning `{ missing: [...], done, total }`
    against §6.2. Surfaced on `GET /brands/me`, `GET /influencers/me`, `GET /brands/:id`,
    `GET /influencers/:id` (admin), and the two pending queues.
11. `POST /brands/me/submit-for-review`, `POST /influencers/me/submit-for-review`: refused with
    `PROFILE_INCOMPLETE` + the missing list; otherwise stamps `submitted_for_review_at`, clears
    `rejection_reason`, and moves `rejected → pending`. `POST /brands/resubmit` becomes an alias.
12. Approval refuses an incomplete profile with the same code on both paths (admin brand status
    → approved; creator-verifications verify).
13. `requireApproved` on every creator action router: invitations accept/decline, item 6, item 7,
    item 8, item 10, production, proposals, discovery find-brands, withdrawals.
14. Branches: create/update take `name`, `address_text`, `pincode`, `state_id`, `city_id`; the
    second branch requires an explicit `is_main` (`MAIN_CHOICE_REQUIRED`); `place_id` and
    `POST /places/resolve` retired for brand and creator (the follower endpoints stay).
15. Admin: `GET /admin/niches/other` (queue), `POST /admin/niches/other/:influencerId/map`
    `{ code }`, `POST /admin/niches` `{ code, label }` (adds and maps when `influencer_id` given).
16. Agreement snapshot gains brand GSTIN, creator PAN, brand street/pincode, both city/state; the
    PDF prints them, blank when missing. `brands.phone` is no longer selected anywhere.
17. Tests: `backend/tests/registration-profile.test.js` (checks 1–40) + the drifted suites
    corrected deliberately (factories, brand/influencer/item2/item3 tests).

## Phase 3 — the phones
18. Creator: C1/C1b register (state → city), C2 unchanged, C3 pending home + finish-profile
    sheet, C4 profile main (completeness banner, Submit for review, Payment & tax row gone),
    C5 profile info (pickers, age, gender, email), C6 niche + Other + 30 languages, C7 wallet
    with UPI / bank+IFSC / PAN entries, C8 rejected form.
19. Brand: B1 register, B2 pending home, B2b the pending sheet on `ACCOUNT_PENDING`, B3 profile
    main, B4 business details (GSTIN out, email in), B5/B6 branches four-part, B7 second-branch
    sheet, B8 wallet with GST + bank, B9 rejected form.
20. Gate: after OTP, pending enters the app; rejected → the new Rejected screen; Waiting
    retired. `api.js` raises an `ACCOUNT_PENDING` event; a sheet host in both navigators renders
    B2b.

## Phase 4 — admin
21. A1 brand review list rewritten to §6.2; map-pin block deleted. A2 creator roll-up new.
    A3 `/admin/niches/other`. nav-sweep updated.

## Phase 5 — evidence
22. `06-diff/notes.md`, governance check, build summary in `lock.json`.

## Deploy (after the founder's explicit go)
run-188 `--dry` shown → `--apply` → commit → push (Render + Vercel) → OTA brand → OTA influencer.
