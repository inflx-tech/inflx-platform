# registration-and-profile — expected outputs

Each check becomes an assertion in `backend/tests/registration-profile.test.js` unless marked
(mobile) or (admin). The build summary reports every one.

**The lists**
1. `GET /reference/states?offered=1` → 6 states, 146 cities, none outside the six.
2. `GET /reference/states` (no flag) → still every state and city, so matching keeps working.
3. `GET /reference/languages` → 30 items, English first, Hindi second, Telugu third; no Sanskrit.
4. `GET /reference/creator-niches` → 21 items, `other` last.

**Registration**
5. Brand register with `state_id` + `city_id` → 201; `users.city/state` hold the reference names;
   the main branch carries `city_id`/`state_id`; no lat/lng written.
6. Brand register without `city_id` and with an unresolvable typed city → 422 `CITY_REQUIRED`.
7. Brand register with `latitude`, `google_maps_url`, `referral_code` → 201 and none of them stored.
8. Brand register with a pincode that is not six digits → 422 on `pincode`.
9. Creator register without `state_id`/`city_id` → 422; with them → 201 and `city_id`,
   `state_id`, both names, and `users.city/state` written.
10. Creator register with a city that does not belong to the given state → 422 `CITY_REQUIRED`.

**Profile**
11. `PATCH /influencers/me` with `age`, `gender`, `email`, `state_id`, `city_id` → stored;
    `GET /influencers/me` returns them plus `city_name`, `state_name`.
12. `PATCH /influencers/me` `language: ['Klingon']` → 422; `['Telugu','Tulu']` → 200.
13. `PATCH /influencers/me` `niche: ['other']` without `niche_other` → 422; with it → 200 and
    the creator appears on `GET /admin/niches/other`.
14. `PATCH /influencers/me` `place_id` → ignored (no Google call); `POST /places/resolve` → 404.
15. `PATCH /brands/me` with `email`, `contact_person`, `about` → stored. With `address_line`,
    `pincode`, `state_id`, `city_id` → the main branch is rewritten and `users.city/state` follow.
16. `PATCH /brands/me` `bank_account_no` without `bank_ifsc` → 422 `BANK_PAIR`; with both →
    stored encrypted; `GET /brands/me` returns `has_bank_account: true` and never the number.
17. `PATCH /brands/me` with `latitude` / `google_maps_url` → 200 and nothing changes.

**Completeness and submission**
18. Fresh creator's `GET /influencers/me.completeness` → missing = photo, bio, niche, language,
    age, gender (6 of 10 done: name, state, city, handle).
19. Fresh brand's `GET /brands/me.completeness` → missing = logo, about, contact person (7 of 10).
20. `POST /influencers/me/submit-for-review` while incomplete → 422 `PROFILE_INCOMPLETE` with
    the missing list; after completing → 200 and `submitted_for_review_at` set.
21. Same for `POST /brands/me/submit-for-review`.
22. Rejected creator: `PATCH /influencers/me` still works; submit → `users.status = 'pending'`,
    `rejection_reason` cleared, `submitted_for_review_at` refreshed.
23. `POST /brands/resubmit` on a rejected complete brand → same effect as 21.
24. Admin approve of an incomplete brand → 422 `PROFILE_INCOMPLETE`; complete → 200.
25. Creator verify of an incomplete creator → 422 `PROFILE_INCOMPLETE`; complete → 200 and the
    measurement kick fires as before.
26. `GET /brands/:id` (admin) and `GET /influencers/:id` (admin) carry `missing_fields`.
27. Pending queues carry `submitted_for_review_at` and `missing_count`.

**Gating**
28. Pending creator: accept invitation, counter, sign, create pitch, shoot accept, find-brands,
    withdrawal → all 403 `ACCOUNT_PENDING`. `GET /influencers/me`, `PATCH /influencers/me`,
    `GET /influencers/me/earnings`, reference lists → 200.
29. Approved creator: the same routes behave as before (no regression in item 5–10 suites).

**Branches**
30. Second branch without `is_main` → 422 `MAIN_CHOICE_REQUIRED`; with `is_main: true` the new
    one is main and the old one is not; with `false` the reverse.
31. Third branch without `is_main` → 201, not main.
32. Branch create with `place_id` only → 422 (street required); with the four parts → 201,
    `formatted_address` = street, `google_place_id` null.

**Other niche queue**
33. `POST /admin/niches/other/:id/map { code:'food' }` → creator's niche = `['food']`,
    `niche_other_resolved_at` set, gone from the queue.
34. `POST /admin/niches { code:'pets', label:'Pets', influencer_id }` → 21 → 22 niches, creator
    mapped; duplicate code → 409.

**Agreement and payout**
35. Snapshot for a brand with GSTIN and a creator with PAN prints both plus both addresses; with
    neither on file the fields are empty strings and the document still renders.
36. `GET /brands/me` no longer returns `business_phone`; `login_phone` stays.

**Regression**
37. `compare.js baseline_reg.json after-reg.json` — 0 new failures beyond the deliberate drift
    listed in the build summary.

**Mobile** (jest in `Packages/Mobile`)
38. Register screens: creator step 1 refuses without state + city; brand refuses each of the
    seven; city picker disabled until a state is chosen; payloads carry ids.
39. `ACCOUNT_PENDING` from any call opens the pending sheet once; OTP gate sends pending into
    the app and rejected to the new screen.
40. Profile main shows "N things left" and disables Submit until zero; Payment & tax row absent;
    wallet shows the three (creator) / two (brand) entries.

**Admin** (Playwright nav-sweep + manual)
41. `/admin/niches/other` reachable; A1 list names logo/about/contact person for the practice
    brand; A2 list present.
