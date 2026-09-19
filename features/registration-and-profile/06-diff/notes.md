# registration-and-profile — before/after notes

## Phase 1 — the lists (migration 188)

**Before:** 36 states and 92 cities, every one offered in every picker; creators' cities typed
free-hand at registration; 10 languages; 20 niches.

**After:** the same rows plus 115 southern district headquarters (146 offered in total, under six
offered states), `is_offered` on both tables, 30 languages in the founder's order, an `other`
niche. Nothing deleted; Rajahmundry renamed to the founder's spelling rather than duplicated.
`GET /reference/states?offered=1` is what the pickers read.

## Phase 2 — the server

| | Before | After |
|---|---|---|
| Brand register | typed city/state on `users`, coordinates, Maps URL, referral code, GSTIN | seven fields; `state_id` + `city_id` resolved to a row; main branch carries the ids; Google and referral fields ignored |
| Creator register | name, optional typed city, handles | name, `state_id`, `city_id` (required, resolved), handles |
| Creator profile | Google `place_id` city; language unvalidated; no age/gender/email | the two pickers; language from the 30; age, gender, email; `Other` + description |
| Brand profile | coordinates, Maps URL in the whitelist; no email; bank only on the website's JSON | email; bank account + IFSC as one encrypted entry; address edits rewrite the main branch |
| Completeness | none server-side | one rule (`profileCompleteness.service`), surfaced on `/me`, admin detail and both queues |
| Submission | registration = queue entry | `POST …/me/submit-for-review` (both sides); refused with the list while incomplete; from rejected it is the resubmit |
| Approval | approve regardless | `PROFILE_INCOMPLETE` on the admin brand status path and on creator verify |
| Creator gate | no creator action checked approval | `requireApproved` on invitations, item 6/7/8/10, production, discovery, withdrawals, posting |
| Branches | Google place id or typed line with the brand's city assumed | four parts, city picked; second branch must state `is_main` |
| Places | `POST /places/resolve` | gone (follower endpoints untouched) |
| Agreement | names and cities | + GSTIN, PAN, both registered addresses (blank when missing) |
| Payout | `listing_data.bank_details` | the encrypted row entry first, JSON as fallback |

## Phase 3 — the phones (against C1–C8, B1–B9)

| Mockup | Built | Departures |
|---|---|---|
| C1 / C1b | `InfluencerRegisterScreen` step 1 + `OfferedStateCityFields` (state, then "Your nearest major city" with the helper line verbatim; city locked until a state; searchable list with "N cities in State") | none |
| C2 | unchanged | none |
| C3 / B2 | `PendingHomeScreen` + `FinishProfileSheet` (once per app session while incomplete); renders the old ComingSoon when approved | none |
| B2b | `PendingSheetHost` mounted once per navigator, fed by `api.onAccountGate` on any 403 ACCOUNT_PENDING / ACCOUNT_REJECTED | none |
| C4 / B3 | `ProfileScreen` / `BrandProfileScreen`: status tag, "N things left", red dots on the owning rows, Submit for review → "Sent for review · date" → hidden when approved; Payment & tax row gone | B3's two orange item-3 reminders replaced by the dots |
| C5 | `ProfileInfoScreen`: pickers, Age, Gender sheet, Email | Bio / Age / Gender do not block saving a handle fix; the profile nags instead |
| C6 | `NicheLanguagesScreen`: dashed Other chip → "What kind of content?" + the blue note; 30 languages | none |
| C7 / B8 | `CreatorWalletScreen` / `BrandWalletScreen` + `DetailSection`; `PayoutDetailScreen` (UPI · bank number+IFSC together · PAN) / `BrandPayoutDetailScreen` (GST · bank) | none |
| C8 / B9 | `RejectedScreen`: remarks, the own form pre-filled, "Send for review again" = PATCH changed fields → submit; PROFILE_INCOMPLETE → "Finish my profile" into the app | none |
| B1 | `BrandRegisterScreen` rewritten: seven fields, Fashion stated, chips, button off until all valid | none |
| B4 | `BrandBusinessDetailsScreen`: GSTIN out, Email in, phone = login number | none |
| B5 / B6 / B7 | `BrandBranchesScreen` four-part cards + Make main; `BrandBranchEditScreen` four-part form + `MainBranchSheet` on the second branch (or on the server's MAIN_CHOICE_REQUIRED) | none |

Deleted: `WaitingScreen`, `PaymentTaxScreen`, `PlaceSearchField`; `referenceApi.placesAutocomplete`
/ `resolvePlace` (the follower app's `followerApi.*` places calls stay). The OTP gate sends
pending into the app and rejected to the new screen.

## Phase 4 — admin (against A1–A3)

**A1 before:** the review page asked for GST number and a map pin and never for about, contact
person, city, state or sub-categories. **After:** the red "N things missing" card and every
"Missing" tag come from the server's list; GST reads "Not supplied · not required"; the map-pin
block is deleted.

**A2 before:** every field with a "Not stated" placeholder, no roll-up. **After:** the same card,
a review table with photo, bio, age, gender, email, niche (Other + what she typed, "needs
mapping" linking to the queue), languages, and "PAN / bank · not required".

**A3:** new `/admin/niches/other` — Creator / She typed / Action, with "Map to…" and "Add as new
niche" (modal), the explanatory note, an empty state; in the nav under People.

Departures from the mockups: A1/A2 keep the existing rule that approve and reject live on the
Pending Verification tab (the mockups drew the buttons on the detail page; the pages already
say where the decision is made, and §9A.1 says corrected, not created).

## Fix, 19 Sep 2026 — the pending brand could still reach campaigns and creators

**Reported by the founder** after registering Anu Fashion World: straight into campaign creation
and creator browsing before approval. **Cause:** the server gated only campaign create/update/
delete and the old creator search; the creators list the phone uses (discover-creators),
worked-with, the creator profile page, groups, campaign lists and sets, the pool, the pitch inbox
and creator-invitations were open; and the Campaigns / Creators tabs were live tabs.

**After (server):** `requireApproved` on discovery, every campaign route, groups, item 6/7/8/10
brand routes, creator-invitations; `requireApprovedFor('brand')` on the shared creator-profile
route so admin passes. A pending brand keeps `/brands/me`, branches, wallet, pitch settings and
the reference lists. **After (phones):** the account's status is held in a small store fed by OTP,
cold start and every `/me`; tapping Campaigns / Creators (brand) or Collabs / Create (creator)
while not approved is swallowed and raises the B2b sheet; the app opens on Home for such an
account; the locked Home tiles raise the sheet on tap instead of being dead.
