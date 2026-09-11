# Item 3 — Discovery, Profiles & Creator Groups: build summary (2026-09-11)

Built to the rules doc v1.11, the locked mockups, the item 3 prompt and your approval message.
**Nothing is deployed yet.** Deploying = apply migrations 170–174, push, publish two OTA bundles.

## 1. What changed

**Both phone apps** now open on five bottom tabs. Tabs that come with later items (Home, Campaigns,
Wallet, Create) show the "coming soon" screen with a button that lands somewhere that works.

**Brand app**
- **Creators tab:** Discover (search, filters, sorts, live count, status chips, "Blocked by you"),
  Groups (create, rename, delete, add from Discover / Worked with / a card / a profile, 100 cap,
  suspended hidden), Pitches (coming soon), Worked with (both-signed only).
- **Creator profile:** numbers with "updated {date}", "{N} collaborations signed on INFLX" (hidden at
  0), "In your groups", Open-to card or the two grey banners, Invite (coming soon), Add to group,
  "Collaborations with you", Open Instagram / YouTube, Block / Unblock.
- **Profile tab:** row list → Business details (logo upload with the 5 MB rule, About, contact person,
  GSTIN, masked login phone), Sub-categories, Branches (Google address, Main chip, Open in Maps,
  Remove), Links, Brand overview ("This is what creators see."), Pitch settings, Legal. Orange
  reminders when sub-categories or the main branch city are missing.

**Creator app**
- **Collabs tab:** four segments, "Pitch a brand" → Find brands (status chips, filters, sorts) →
  Brand overview (about, accepts card or banner, products with out-of-stock, branch cities, links) →
  Product detail (sizes struck through when unavailable, no buying).
- **Profile tab:** row list → Profile info (photo ≤ 5 MB, name, bio, city through Google, numbers
  read-only), Niche & languages, Invitation settings, Payment & tax (its own screen, same content),
  Legal. The notifications switch is gone.

**Server** (every caller, including the website)
- New: discover-creators, worked-with, branches, find-brands, brand products, places/resolve,
  cities-by-id, groups-for-one-creator.
- Changed as supersets: `/brands/me`, `/brands/:id/public`, `/influencers/me`, `/influencers/:id`,
  `/influencers/search`, the group routes.
- All four privacy leaks closed. Creator search/detail are approved-only. Groups: names 1–40,
  unique per brand, 100 creators, approved members only. States are never auto-added; only cities.
- Brand registration now creates the Main Branch row automatically (found by the tests).

**Database** (dry run against production clean; will be applied on your go)
- 36 states and union territories (was 17), 92 cities (was 63), state alias table, unknown-state log.
- Brand profile columns (about, website, Instagram, contact person). `brand_branches` with exactly
  one main branch per brand (9 of 9). Creator `city_id` for 25 of 25 creators. Group constraints.
  Indexes for the lists. No campaign, invitation, contract, proposal or wallet row is touched.

## 2. Unmatched cities after seeding
- **Creators:** none — all 25 creators match a city (Delhi ×2 and Ongole came from your CSV).
- **Brands:** one main branch without a city — **"Hotel Village"**, because its account never had a
  city or state. It will see the orange reminder "Add your main branch address so creators can see
  your city." on its Profile tab; one address pick fixes it.

## 3. Test results (your check 28)

| Run | Backend tests failed / passed / total |
|---|---|
| Before the test-factory fix | 474 / 521 / 1036 |
| After the factory fix, before item 3 (commit 6ff5a14) | 229 / 807 / 1036 |
| End of item 3, first full run | 233 / 865 / 1098 (62 new tests, all passing) |
| End of item 3, final full run | **229 / 869 / 1098** — zero new failures versus the after-fix run |

New failures at the end of item 3 versus the after-fix run, compared test by test: **four old tests**,
each asserting a rule item 3 changed on your decision (pending creators hidden from brands ×2, branch
cities from `brand_branches` instead of the typed JSON, 36 states / 92 cities instead of 17 / 63). Their
assertions were updated to the new rules and they pass; no behaviour was changed to make them pass.
Nothing else moved: zero tests fixed by accident, zero tests disappeared.
Item 3's own tests: 8 backend suites / 62 tests pass; 3 mobile suites / 22 tests pass; the item 2
mobile suites (36 tests) still pass; the release JS bundle builds without errors.

## 4. Website side effects (no website code was changed — for the website discussion)
1. Website creator search stops showing pending creators; a pending creator's page is 404 to a brand.
2. The website branch editor no longer changes branches — branches live in `brand_branches` now; the
   JSON it saves is not read for cities any more.
3. Group rules now apply to "Shortlist": name 1–40, unique per brand, 100 creators, approved only.
4. Website group lists and counts exclude suspended creators; rejected creators leave every group.
5. Website brand detail and store pages no longer receive the street address, phone or JSON branches.
6. `/brands/me`: `phone` now means the login phone; the business phone is `business_phone`.
7. Brands registered from the website also get a Main Branch row automatically.

## 5. How to try checks 1–31 on a phone

Legend — **Auto:** pinned by an automated test that passes today. **Phone:** your walk (after the OTA).

| # | Do this | You should see | Auto |
|---|---|---|---|
| 1 | Open both apps; tap every tab | Five tabs; Home/Campaigns/Wallet (brand) and Home/Create/Wallet (creator) show the coming-soon text; the button opens Creators / Find brands / Payment & tax | pass |
| 2 | Brand → Profile → Business details: pick a 4 MB JPG, then a 6 MB PNG; type 201 characters in About | JPG saves; PNG → "Upload a JPG or PNG under 5 MB."; About counter turns red and Save stays grey | pass |
| 3 | Log in as a brand with no sub-categories | Orange reminder on Profile; Sub-categories screen refuses an empty save | pass |
| 4 | Branches → Add: search an address in a city not on the list (e.g. Warangal); repeat with a second brand | First brand: "Warangal is new on INFLX…" toast; second brand: no toast, one city row | pass |
| 5 | Branches: Remove on the main branch; then Edit another branch → Make main | "The main branch can't be removed…"; the Main chip moves | pass |
| 6 | Creator → Profile → Profile info: search your city; look at Your numbers; Niche & languages with none picked | City resolves to city + state; numbers read-only with "Updated d Mon"; Save grey until a niche is picked | pass |
| 7 | Brand → Creators → Discover; switch "Open to invitations" off | Default: only approved OK creators, count = list; off: paused → "Not taking invitations"; a creator who blocked you looks identical; Women-only creator vs a Watches brand → "Not open to your brand" | pass |
| 8 | Filters: Instagram 10K+, Engagement 2%+, City Hyderabad; Clear all | Only matching creators; "Show N creators" = list length; Clear all resets | pass |
| 9 | Search "@priya" then "Sharma" | Handle match; name match | pass |
| 10 | (API) read the Discover, creator profile and brand overview responses | No email, phone, visit cities, categories, minimums, block info; no address, GSTIN, phone, contact person, offers | pass |
| 11 | Creators → Worked with | Only both-signed creators; an agreed-but-unsigned handshake is absent; "N collaborations · last signed d Mon" | pass |
| 12 | Open a worked-with creator | "Collaborations with you" lists only your signed collaborations | pass |
| 13 | Groups → New group "Diwali shortlist", then "diwali shortlist", then 41 characters | Created; "You already have a group with this name."; "Keep it under 40 characters." | pass |
| 14 | Group → Add creators: tick 3; fill to 100; try the 101st | Members already in are ticked and grey; "… is full (100 creators). Remove someone or use another group." | pass |
| 15 | ＋ on a Discover card and Add to group on a profile; untick in the sheet | Toasts "Added to X." / "Removed from X."; profile shows "In your groups: …" | pass |
| 16 | Remove a member, rename, delete a group | All work; campaigns/contracts/proposals untouched | pass |
| 17 | (API) open a group id with another brand's login | 404 | pass |
| 18 | A member pauses invitations; reopen Groups and the group | "open to invitations" drops by one | pass |
| 19 | Group → Invite to a set / New campaign | Coming-soon toasts; nothing created | copy pinned |
| 20 | Creator → Collabs → Find brands; toggle "Brands I can pitch"; filters; sorts | Defaults to pitchable; "Not accepting" / "You don't match" chips; category, city, Aim, mode filters; A–Z and Most products | pass |
| 21 | Open a brand → products → a product | Published products only at list price; "Out of stock" per the rule; detail read-only with unavailable sizes struck, no buy | pass |
| 22 | Brand → Profile → Brand overview | "This is what creators see.", Edit details, Pitch settings; no Pitch button, no ⋯ | built |
| 23 | Turn data off and open Discover / Worked with / Groups / Find brands / a profile | Loading, empty and "Couldn't load" states; Try again works | built |
| 24 | Admin rejects a creator who is in a group | She disappears from every group | pass |
| 25 | Backend tests | No new failures vs the after-fix baseline | see §3 |
| 26 | (API) shopper brand store | No branches, phone numbers or addresses | pass |
| 27 | Admin suspends a group member, then approves again | Hidden from the group and counts; back in the same group after approval | pass |
| 28 | Baselines | Three numbers in §3 | done |
| 29 | Creator city picker; a Delhi address; an overseas address | 36 states listed; Delhi resolves to Delhi/Delhi without a new state; "We couldn't match this address to a state…" and nothing added | pass |
| 30 | Creator profile with 0 and with 2 signed collaborations | Line hidden at 0; "2 collaborations signed on INFLX"; P2 lists only both-signed | pass |
| 31 | Block a creator, then look at Discover, a group she is in, and her profile | Grey "Blocked by you" chip in all three; ⋯ offers Unblock | pass |

## 6. Deploy (on your go)
1. `node backend/scripts/run-170-174.js --apply` (prints the same before/after table as the dry run).
2. `git push` (Render redeploys the backend; the website redeploys unchanged).
3. Verify: a new route answers 401 without a token, a fake sibling 404.
4. `pnpm publish-ota:brand` and `pnpm publish-ota:influencer` (native runtime 3); check the manifest.
Rollback: previous bundles are brand 210 / influencer 198; the migrations only add.
