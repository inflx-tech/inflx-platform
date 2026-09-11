# Item 3 — Discovery, Profiles & Creator Groups · Phase 1 gap report

**Date:** 2026-09-11 · **Inputs:** `INFLX_Master_Business_Rules_Phase_1_v1.11.docx` (§5, **5A**, 8, 8A, 15, 16A; related 2, 13, 19, 27, 31), `INFLX_Item3_Discovery_Mockups.html` (A1–A9, D1–D5, G1–G10, P1–P4, F1–F3, O1–O4), `INFLX_Item3_Gap_Check_Prompt.md`.
**Repo read:** `main` at `2d3934b` (item 2 live: migrations 168/169, OTA brand 210 / influencer 198). Production data was read with a read-only transaction; nothing was changed.
**Status:** Phase 1 only. No code, migration or data was touched. Stop point for approval.

**One vocabulary correction first.** The prompt's table says the 8 sub-categories live in `brands.major_categories`. Item 2 actually created **`brands.sub_categories text[]`** (`backend/migrations/168_item2_reference_lists.sql:208-211`). Everything below uses the real name.

---

## 1. Summary

| Area | Status | The one-line gap |
|---|---|---|
| Bottom tabs and placeholders | **M** | Both apps are single stacks since the profile-only cut. `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context` and `react-native-vector-icons` are all still in the binary, so tabs ship over the air. |
| Brand business details (A1–A3) | **P** | Name, GSTIN, sub-categories, logo URL exist. **About, website, Instagram handle and a typed contact person do not.** Logo is a pasted URL, no upload. `brands.phone` is unreachable through the API (shadowed by the login phone). |
| Branches (A4–A5) | **C** | Free-text JSON on the brand row (`listing_data.branches[]`), seven keys, no ids, no main flag, no place id. One reader (item 2 visit-city match by name). Branch phones and addresses leak to the public shopper store. Needs a table. |
| City auto-add (A5, A8) | **M** | Google Places details already return city, state and pincode server-side; nothing resolves them to `ref_cities` or inserts new cities. |
| Creator profile (A7–A9) | **P** | Photo upload, name, bio, handles and the single required niche exist. City is free text on two columns and `influencers.city_id` is never written. Bio has no limit. YouTube handle is not normalised on edit. **All 22 creators' niches are stored capitalised and do not match the item-2 codes.** |
| Measured numbers (D5) | **P** | Instagram followers and engagement are filled at sign-up and on an admin rescrape only; no scheduled refresh. YouTube is never measured (0 of 25). A measured-at timestamp exists on 3 of 25 creators. |
| Creator groups (G1–G7) | **P** | A real `influencer_groups` feature exists with six endpoints and a live brand-web "Shortlist" UI (7 groups, 28 members in production). No name uniqueness, no 100 cap, no `added_by`, no status per member, no open-to count, list not paged. Extend it; do not build a second one. |
| Worked with (D5) | **M** | No endpoint. The data exists: contracts with both signatures. |
| Discover creators (D1–D4) | **C** | `GET /v1/influencers/search` exists and the website depends on it, but it returns **pending** creators, has no Aim/mode/engagement/YouTube filters, no per-row status, and sorts by a rank that is null for registered creators. Build a new brand-only endpoint; leave the website's untouched except the approved-only fix. |
| Creator profile for a brand (P1–P4) | **P** | `GET /v1/influencers/:id` + item 2's `inviteSummary` and X4 screen exist. Missing: completed count, collaborations with this brand, groups line, measured-at date. No email or phone leaks to brands. |
| Find brands (F1–F3) | **P** | `discover-brands` exists (approved, accepting, not-blocked) but has no paging, no total, no filters beyond name/category/city, no per-row status, and its facets still read the retired on/off column. |
| Brand overview (O1–O4) | **P** | `GET /v1/brands/:id/public` + item 2's X1 screen exist. **Leaks the street address.** No about, links, branch cities, branch count, products or `isOwner`. |
| Products for the overview (O1, O3) | **P** | Publication rule is clear in code. Product count and out-of-stock need a rule. Images and sizes live in `variants_json`, not `product_variants` (0 rows). |
| Posts placeholders (P2, O2) | **P** | `creator_posts` exists with a public feed that already filters by brand; an empty-grid component is all item 3 needs. |
| Collaboration state (P2) and "completed" (P1) | **P** | State lives on `campaign_influencers.status` (12 values). "Completed" is written by one job, only when escrow is fully released, so **a Pay for Sale collaboration can never become completed today.** |
| Privacy today | **C** | Four leaks found (§4). |
| Approval and visibility | **P** | `users.status='approved'` is the flag on both sides. Search does not apply it to creators. |
| Test baseline | — | 474 failed / 562 passed / 1036 tests (100 suites) at `2d3934b`. |

---

## 2. Requirement table

Status: **E** exists · **P** partial · **M** missing · **C** conflicts. "(item 2)" marks item-2 work.

### 2.1 Data (D1–D12)

| ID | Requirement | Status | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1 | Brand details: logo, name, about ≤200, contact, GSTIN, masked phone, major category, sub-categories, links | **P** | `brands` columns `001_initial_schema.sql:127-146` + later; `sub_categories` (item 2) `168:208`; `logo_url` is a pasted URL in both editors (`brand-web/app/dashboard/settings/profile/page.js:414-425`, `Mobile/.../BrandProfileScreen.js:291-301`). **No** `about`, `website`, `instagram_handle` columns. Contact person lives untyped in `listing_data.contact_person_name` (written `profile/page.js:332`, `BrandProfileScreen.js:164`; read by no backend code). `brands.phone` (`032:12`) is shadowed by `u.phone` in `getBrandByUserId` (`brand.controller.js:56-69`) so both editors copy the **login** phone into the main branch. | Migration 170: `about varchar(200)`, `website_url text`, `instagram_handle text`, `contact_person text` (backfill from `listing_data.contact_person_name`). Fix the shadow: select `u.phone AS login_phone`. Logo upload endpoint (A1). | Low. `contact_person` backfill touches 1 row. |
| D2 | Branches: name, place id, address, pincode, lat/lng, `city_id`, `state_id`, exactly one main, timestamps | **C** | JSON only: `listing_data.branches[]` with keys `name,state,city,pincode,address,phone,google_maps_url` (`brand.controller.js:239-251`; writers `profile/page.js:320-334`, `BrandProfileScreen.js:142-166`). Main = `name === 'Main Branch'` by convention. **Readers:** item 2 `collabEligibility.service.js:225-244` (city names only, matched by name); the multi-branch entitlement count `brand.controller.js:255-264`; the public shopper store passes the whole `listing_data` through (`follower.service.js:745`). Shoot plans do **not** read branches: Store Visit addresses are typed per shoot into `production_events.visit_*` (`024_production_coordination.sql:32-41`; allow-map `production.service.js:301-305`). Production: 1 of 9 brands has a branch (Vijayawada, matched); the other 8 have none; brand cities on `users.city`: 7 matched, `Karnal` unmatched, 1 null. | **Move to a table** `brand_branches` (§5). Backfill: existing JSON branches + a main branch from `users.city`/`address_line` where the city matches. Eligibility reads the table. Stop writing branches into `listing_data`; leave the old key in place (additive). | Medium: two whole-object `PATCH /brands/me {listing_data}` writers on the website (`publishDriver.js:171`, `RestaurantDishPicker.js:164`) stay as they are and become harmless once branches leave the JSON. |
| D3 | City auto-add with `source='google'`, no duplicates, toast once | **M** | `places.service.js:49-78` `details()` already returns `city` (locality), `state` (admin level 1), `pincode`, `lat/lng`, `formatted_address`. Nothing maps them to `ref_states`/`ref_cities`. `ref_cities` has `UNIQUE(state_id,name)` and `source` (item 2, `168:63-73`) but no unique on the normalised name. Client-side only: `BrandRegisterScreen.js:104-117`. | New `places.resolve(place_id)` in `referenceLists.service`: find state by name (with a small alias map, e.g. "NCT of Delhi" → "Delhi"), find city by `name_norm`, else `INSERT … ON CONFLICT DO NOTHING RETURNING id` and re-select; return `{cityAdded}`. Add `UNIQUE (state_id, name_norm)`. | Low. |
| D4 | Creator profile: photo, name, bio ≤150, city as `city_id`, handles, one niche, languages | **P** | Photo flow exists (`influencer.controller.js:434-451`, key `creator-photos/<id>/<ts>.<ext>`, jpeg/png/webp, **no size cap**). `PATCH /me` accepts `bio, city, full_name, youtube_handle, language, niche` (`:457-540`); `bio` unlimited (`bio TEXT`, `004:5`); `city` written to `influencers.city` only (register writes `users.city`, `:268-271`); **`influencers.city_id` never written**; `youtube_handle` not normalised on edit (`:503`) though it is at register (`:83-86`); niche = exactly one code (item 2, `:489-502`). Production: 22 of 25 creators have a single niche but **capitalised** (`Fashion` 13, `Fitness` 4, `Lifestyle` 3, `Beauty` 2) so none match `ref_creator_niches`; 3 have none; languages null for all 25; creator cities 22 matched, `Delhi` ×2 and `Ongole` unmatched. | Server: bio ≤150, name required, city via place id → `city_id` (+ auto-add), normalise YouTube on edit, accept a YouTube URL. Migration 170: lower-case the four legacy niche values (all exist in the list). Backfill `city_id` by name. | Low. The niche fix is a 22-row data correction. |
| D5 | Measured numbers read-only, with last-measured date; null = "—" | **P** | `followers_count`, `engagement_rate` written only at register (`:275-303`) and admin rescrape (`:1179-1225`); `youtube_subscribers` via `refreshYouTubeStats` (`:99-121`, returns early when not configured). Timestamps: `scrape_last_run` (`001:168`), `youtube_scrape_last_run` (`160:24`). **No cron refreshes them** (`jobs/index.js:44-98`; the Apify job only writes `deliverable_stats`). Production: IG on 25/25, YT on 0/25, timestamp on 3/25. `PATCH /me` already refuses these fields (not in the accept list). | Return `measured_at = GREATEST(scrape_last_run, youtube_scrape_last_run)` on profile and Discover rows. Nothing else in item 3; a refresh job is separate work. | The date will read "—" for 22 creators until they are rescraped. |
| D6 | Groups: name 1–40 unique per brand case-insensitive, `updated_at` on member change, members unique with `added_at`, `added_by`; cap 100; approved creators only; cascade delete; removed accounts drop out; private to the brand | **P** | `influencer_groups (id, brand_id, name varchar(120), created_at, updated_at)` + `influencer_group_members (group_id, influencer_id, added_at) PK(group_id,influencer_id)` (`123_influencer_groups.sql:18-31`). Name: required, ≤120, **no uniqueness** (`influencerGroup.controller.js:130-135`). **No cap, no `added_by`, no approved check** (`:65-82` checks existence only). Delete cascades members only (`:188-198`); `brand_collab_requests.origin_group_id` is `ON DELETE SET NULL` (`149:125`). Brand = one login (`brands.user_id UNIQUE`, `001:129`; mig 153 keeps one row per role). Account removal: **no deletion path exists** in the backend; the only in-product state is `users.status='suspended'` (`admin.controller.js:199-236`); a hard delete would cascade to members (`123:27`) but be blocked by `campaign_influencers` (`001:233`, no action). Production: 7 groups / 28 members, names ≤22 chars, no case-insensitive duplicates within a brand. | Migration 171: `added_by uuid` on members, `UNIQUE (brand_id, lower(name))`, `CHECK (char_length(name) BETWEEN 1 AND 40)` (existing rows pass), trigger or service update of `updated_at` on member add/remove. Service enforces cap 100 and `users.status='approved'`. Reads filter members to approved creators; a status change to `suspended`/`rejected` deletes that creator's member rows. | Low. |
| D7 | Worked with: creators with ≥1 contract signed by both, count, latest signature | **M** | Signatures are authoritative on `contracts.influencer_signed_at` + `brand_signed_at` (`006:26-29`; written `contract.controller.js:433-442`, `:518-524`). `campaign_influencers.contract_signed_at/brand_signed_at` are dead columns, never written. Handshake `collab_agreements` are agreed-not-signed → excluded. Item 2 already has this query for one pair (`collabEligibility.service.js:192-208`). | New endpoint (A7) over `contracts ⋈ campaign_influencers ⋈ campaign_sets ⋈ campaigns`. | — |
| D8 | Collaborations with this brand (campaign, set, Aim, signed date, state family); completed count across brands | **P** | State = `campaign_influencers.status`, 12 values (`001:21-23`, `038:10-12`, `167:37`). **`completed` is written in one place only**: `jobs/tranche-3-release.job.js:96-101`, when every escrow entry is released. Pay for Sale has no escrow → never completed. No `completed_at` on the assignment. Production: active 3, completed 1, contracted 2, invited 2. Mobile already maps statuses to families (`Mobile/src/utils/collabStages.js:32-82`). | Family map (§6, A6). Completed count = `status='completed'` for now, with the gap stated (Q5). | The P1 number will under-count sale collaborations until item 1's lifecycle work lands. |
| D9 | Overview data: about, sub-categories, main city, branch count, unique cities, links, published count, products paged; never addresses/phone/email/GSTIN/contact/offers | **P** | `getPublicProfile` returns `id, business_name, category, sub_categories, logo_url, address_line, created_at, city, active_campaigns_count` (`brand.controller.js:995-1017`) — **address leaks**. Published = `is_active AND pushed_to_store AND users.status='approved'` on every shopper surface (`follower.service.js:536-552`, `sectionRules.service.js:1001-1002`). Three different product counts exist (`listing.service.js:256`, `quotaCheck.js:134`, `collabOwedItems.service.js:84`). | Extend A10 with the D9 fields, drop `address_line`; one count definition = the published rule. | Low. |
| D10 | Product detail: images, name, brand, category path, price, sizes with availability, description; published only | **P** | Images: `image_url` + `variants_json.cover_images` + `colors[].images` (resolver `utils/productImage.js:38-60`); no images table. Category path built inline once: `concat_ws(' › ', cn.segment, cn.category, cn.name)` (`brand.controller.js:492`). Sizes: **`variants_json.colors[].sizes[] {size, stock, price, sku}`** written by the website wizard (`publishDriver.js:270`); `product_variants` has **0 rows** in production and is only used by checkout price overrides (`transaction.controller.js:150-165`). Stock is never decremented anywhere (`campaign.controller.js:2189-2192` says so). | Read `variants_json`. Out-of-stock rule in Q6. New public product endpoints (A11). | — |
| D11 | Approval flags | **P** | `users.status` enum `pending/approved/rejected/suspended` (`001:12`) is the only gate for both roles; `brands/influencers.approved_at` are bookkeeping. `GET /influencers/search` returns **pending** creators (view admits `approved,pending`, `146:147`; controller adds nothing); `getPublicById` hardcodes `is_inflx_verified TRUE` (`:843-845`). | Every item-3 list and profile filters `u.status='approved'`; add it to `/influencers/search` too (website then hides pending creators — flagged in §6). | Low. |
| D12 | Search over the whole approved population, pages of 20, live count, per-row status in SQL, group counts in SQL | **M** | `v_searchable_creators` is a plain `UNION ALL` view (`031`, `055`, `146`), scanned three times per search; **no index on `influencers` at all** (only PK/unique), none on `users(status)`. Item 2's `canBrandInviteCreator` runs 4–6 queries per creator (`collabEligibility.service.js:326-410`). | Set-based status expression (§7) + indexes (§5). | — |

### 2.2 API (A1–A13)

| ID | Endpoint | Status | Evidence | Proposed change | Callers today |
|---|---|---|---|---|---|
| A1 | Brand details GET/PUT + logo upload | **P** | `GET/PATCH /v1/brands/me` (`brand.routes.js:28-29`; whitelist `brand.controller.js:268`; `sub_categories` item 2 `:275-277`). Response returns everything incl. `gstin`, `wallet_balance`, `proposal_filters` (self only, acceptable). Brand upload path exists with tag `logo` (`/brands/me/media-assets/upload-url`, 25 MB + quota, `media.service.js:12-26`) but neither client uses it for the logo. | Add `about, website_url, instagram_handle, contact_person` to the whitelist with §7 validation; `login_phone` alias; new `POST /v1/brands/me/logo/upload-url` (jpg/png, key `brand-logos/<brandId>/<ts>.<ext>`) + `DELETE /v1/brands/me/logo`; size ≤5 MB enforced client-side and re-checked server-side on save via a HEAD on the object. | brand-web `settings/profile/page.js:234,344`, `publishDriver.js:171`, `RestaurantDishPicker.js:164`; Mobile `BrandProfileScreen.js`. |
| A2 | Branches list/create/update/remove/make-main with place id resolution and `cityAdded` | **M** | No branch endpoints; JSON edited through `/brands/me`. | `GET/POST /v1/brands/me/branches`, `PUT/DELETE /v1/brands/me/branches/:id`, `POST /v1/brands/me/branches/:id/make-main`. Create/update take `place_id` (+ `name`, `is_main`); server calls Places details, resolves city/state (D3), returns `{branch, cityAdded}`. Main cannot be deleted (422 `MAIN_BRANCH`). | none |
| A3 | Places autocomplete + details proxy | **E (P for cost controls)** | `GET /v1/follower/places/autocomplete?q&session&lat&lng` → `{predictions:[{place_id,main,secondary,description}]}`; `GET /v1/follower/places/details?place_id&session` → `{lat,lng,formatted_address,name,area_name,city,state,pincode}` (`follower.routes.js:31-36`, `follower.controller.js:1406-1423`, `places.service.js:21-78`). `authenticateOptional`, country `in`, 30 km bias, client session tokens. Keys `GOOGLE_PLACES_API_KEY` → fallback `GOOGLE_GEOCODING_API_KEY`; `GEOCODING_MOCK`. **No cache, no rate limit, no daily cap.** | Reuse as-is from the apps (already used by brand registration). Add `POST /v1/places/resolve {place_id}` (authenticated) that returns details **plus** `{state_id, city_id, cityAdded}` — the single entry every later address search uses. Add a 10-minute in-process details cache and a per-user 60/min limit. | `BrandRegisterScreen.js:98-108`, follower address flows, brand-web `GoogleMapsLinkField.js:41` (geocode URL). |
| A4 | Creator profile GET/PUT | **P** | `GET/PATCH /v1/influencers/me` (`influencer.routes.js:24-28`; `:457-540`). Photo upload exists. | Accept `place_id` → `city_id` (+ auto-add, `users.city`/`influencers.city` kept in sync as names); bio ≤150; name required; YouTube normalised/URL accepted; return `measured_at`. | Mobile `ProfileScreen.js` (getMe/updateMe), brand-web none. |
| A5 | Discover creators (brand only) | **C** | `GET /v1/influencers/search` (`influencer.routes.js:16`, `requireApproved`; handler `:574-781`). Params `q` (name/IG handle only), `city,state,niche,tier,languages,use_case,min/max_followers,min_view_er,min/max_rate,…,sort,page,limit`. No Aim/mode/YouTube/engagement-bucket filters, no per-row status, pending creators included, default sort `rank_score` (null for registered → effectively by handle). Website depends on its exact shape (`dashboard/influencers/page.js:625-651`). | **New** `GET /v1/brands/me/discover-creators` with the prompt's query, `total`, rows (`id,name,avatarUrl,nicheCode,nicheLabel,cityName,stateName,languages,instagram,youtube,engagement,measuredAt,acceptedAims,acceptedModes,status,groupIds`), `?countOnly=1`, `?select=1` returns no group ids. Leave `/influencers/search` as the website's endpoint; only add `u.status='approved'`. | `/influencers/search`: brand-web `page.js:643,1528`, Mobile `FindPartyScreen.js:38` (temporary, to be deleted). |
| A6 | Creator profile for a brand | **P** | `GET /v1/influencers/:id` (`influencer.routes.js:105`, brand+admin, no `requireApproved`). Returns the onboarded field list at `:808-846` incl. `youtube_*`, `bio`, `website`, `price_per_post_*`, `user_id`, `created_at`; `inviteSummary` (item 2). **No email ever; phone admin-only** (`:852-862`). | Add `measuredAt`, `completedCollaborations`, `collaborationsWithYou[]` (D8), `groups[]` (names of this brand's groups), `cityName/stateName`. Add `u.status='approved'` gate for brand callers (404 otherwise). Keep every existing field (website admin page reads them). | brand-web `dashboard/influencers/[id]/page.js:286`, `admin/influencers/[id]/page.js:67,119`; admin-web `dashboard/influencers/[id]/page.js:39`; Mobile `BrandCreatorProfileScreen.js:34`. |
| A7 | Worked with | **M** | — | `GET /v1/brands/me/worked-with?search&page` → `{total, rows:[{influencerId,name,avatarUrl,collaborations,lastSignedAt}]}` newest first. | none |
| A8 | Groups | **P** | Six routes under `/v1/brands/me/influencer-groups` (`influencerGroup.routes.js:25-30`): list (all groups + full member arrays, `created_at DESC`), create `{name, influencer_ids?}`, rename, delete, add members `{influencer_ids}`, remove member. Brand-scoped 404s already (`:162-198`). No detail/paging, no status, no groups-for-creator, no set-creator-groups, no cap, no uniqueness. **Mobile bindings dead** (`api.js:208-215`); `askMany` points at a route that no longer exists. | Extend in place, backward-compatible: list gains `memberCount, openCount, updatedAt, avatars[]` (sorted by `updated_at DESC`); add `GET /:id` (header + members paged with status), `GET /for-creator/:influencerId`, `PUT /for-creator/:influencerId {groupIds[]}`; add-members returns `{added, skipped, capacityLeft}` and 422 `GROUP_FULL`; name rules → 422 `NAME_REQUIRED / NAME_TOO_LONG / NAME_TAKEN`. Members restricted to approved creators. | brand-web `lib/api.js:409-416` → `dashboard/influencers/page.js` (ShortlistModal `:247-330`, GroupsManager `:1574+`). Keep the six response shapes a superset. |
| A9 | Find brands (creator only) | **P** | `GET /v1/influencers/me/discover-brands` (`proposal.routes.js:22`; `proposal.service.js:194-240`): approved + accepting + not blocked, `search/category/city`, `LIMIT 30`, **no paging, no total, no status**; `discoveryFacets` still reads `brands.accepts_proposals` (`:252`) — drift from item 2. | **New** `GET /v1/influencers/me/find-brands` with the prompt's query, `total`, rows (`id,logoUrl,name,subCategories,mainCity,acceptedAims,acceptedModes,status,productCount`), `?countOnly=1`. Retire `discoveryFacets`' old column (adjacent fix). | Mobile `FindPartyScreen.js:37` (temporary), `api.js:470`. |
| A10 | Brand overview (+ `isOwner`, no addresses) | **P / C** | `GET /v1/brands/:id/public` (`brand.routes.js:155`, any role): leaks `address_line`; no about/links/branches/products; `pitchSummary` (item 2). | Return D9 fields + `pitchSummary` (creator viewer) + `isOwner` (brand viewing itself); remove `address_line`. | Mobile `api.js:395,445` → `BrandOverviewScreen.js:35`. No website caller. |
| A11 | Brand products list + detail (published only) | **P** | Public product reads exist for shoppers (`/business/:brand_id/store` returns `SELECT *` + variants + offers, `follower.service.js:536-600`; `/listing/nodes/:id/products`). Nothing creator-facing without offers. | `GET /v1/brands/:id/products?page` (published, `{id,name,price,imageUrl,outOfStock}`), `GET /v1/brands/:id/products/:productId` (D10; 404 when unpublished or foreign). Price = `price` (list price; `mrp` display-only per `118:18`). | none new |
| A12 | Posts placeholders | **P** | `creator_posts/post_media/post_products` (`140_creator_posts.sql`); public feed `GET /v1/follower/posts?brand_id=` filters `scoped_brand_ids` (`followerPosts.service.js:110-123`); creator's own `GET /v1/influencers/me/posts`. 3 posts in production. No GIN index on `scoped_brand_ids`. | No new endpoint in item 3; screens render an empty grid component with `count: 0`. Item 13 wires the feed. | — |
| A13 | Reference lists | **E (item 2)** | `GET /v1/reference/creator-niches|languages|brand-categories|states` (`collabSettings.routes.js:37-40`); states nested with cities; cached 60 s. | Add `GET /v1/reference/cities?ids=` for label lookups; cache invalidation on auto-add. | Mobile item-2 screens, brand-web register/profile. |

### 2.3 Screens (§2 of the prompt)

| ID | Screen | Status | Evidence / what exists | What item 3 builds |
|---|---|---|---|---|
| — | Bottom tabs | **M** | Single stacks `BrandNavigator.js:19-36`, `InfluencerNavigator.js:18-34`. Previous tab pattern recoverable at `5e04e1c^` (`createBottomTabNavigator` + `MaterialCommunityIcons`, stack per tab). | Tab navigators, stack per tab, `settingsTokens` styling, four-segment control ≤360 px. |
| A1 | Brand Profile list | **P** | `BrandProfileScreen.js` is a 533-line inline form (business info + branches) with item-2 rows `:414-436`. | Rewrite as a row list with header (logo, "Fashion · subs", "city · N branches"). |
| A2 | Business details | **P** | Fields exist inline (`:250-302`); logo is a URL field. | New screen: upload, About, contact, GSTIN, locked phone/category, sticky Save. |
| A3 | Sub-categories | **E (item 2, moved)** | Chip grid `BrandProfileScreen.js:268-277`. | Own screen with intro, locked card, reminder state. |
| A4 / A5 | Branches / Add branch | **M** | Free-text branch forms `:304-408`. | New screens over A2 endpoints; Google search via A3; city-added toast; main switch; remove confirm. |
| A6 | Coming-soon placeholders | **P** | `BrandPitchesPlaceholderScreen.js` exists (item 2). | One `ComingSoonScreen` component, six configs (§6.1 copy). |
| A7 | Creator My Profile list | **P** | `ProfileScreen.js` 808 lines: inline edit sections, Payment & Tax `:518-590`, **decorative** notifications switch `:592-607` (state read nowhere), item-2 rows `:493-516`. | Row list with header; switch removed; Payment & tax row keeps the existing card behind it. |
| A8 | Profile info | **P** | Photo upload works (`:276-313`); name/bio/city inline (`:371-419`, city plain text); read-only numbers `:355-369`. | New screen: Google city, 150-char bio, handles, "Your numbers" card with measured-at. |
| A9 | Niche & languages | **P** | Chips from reference lists (item 2, `:421-491`). | Own screen with reminder state. |
| D1–D4 | Discover | **M** | `FindPartyScreen.js` is a name search only (item 2, "item 3 replaces it"). | `DiscoverList` component (list + select mode) + filters sheet + states. |
| D5 | Worked with / Pitches | **M** | — | Segment screens. |
| G1–G7 | Groups | **M on phone** | Endpoints + website UI exist; zero phone screens (bindings dead, `api.js:208-215`). | Group list, sheet, detail, picker (G5 = DiscoverList in select mode), add-to-group sheet, menus. |
| G8–G10 | Invite group / new campaign | — | Items 4/5. | Toasts only. |
| P1–P4 | Creator profile | **P (item 2)** | `BrandCreatorProfileScreen.js` 123 lines: header, open-to card, disabled Invite, ⋯ Block. | Complete: measured-at, bio, handle tags, groups line, Add to group, collaborations, posts grid, P3 banner, Open IG/YT. |
| F1–F3 | Collabs tab / Find brands | **M** | `FindPartyScreen` brands mode only. | Collabs tab with segments + card; `BrandList` + filters sheet. |
| O1–O4 | Brand overview / product / own view | **P (item 2)** | `BrandOverviewScreen.js` 112 lines: header, accepts card, banners, Pitch, ⋯ Block. | Complete: about, product grid, see-all, product detail, Brand Store grid, branch cities, links, owner variant. |

### 2.4 Rule groups (§6)

| § | Rule group | Status | Notes |
|---|---|---|---|
| 6.1 | Tabs and placeholders | **M** | All native pieces in the binary (§8). |
| 6.2 | Discover: who appears, brand-level status, search, filters, sort, paging, card | **M** | Brand-level status = steps 1 and 3 of item 2's `canBrandInviteCreator` (`collabEligibility.service.js:326-364`), reimplemented in SQL (§7). Search must add YouTube handle and the `@` strip (today `q` matches name + IG handle only, `:607-610`). |
| 6.3 | Worked with | **M** | D7. |
| 6.4 | Creator profile | **P** | Item 2 covers the open-to card, NOT_ACCEPTING banner, Block. P3 banner, groups line, collaborations, posts, handle tags, measured-at are new. |
| 6.5 | Groups | **P** | Existing endpoints cover create/rename/delete/add/remove; everything about counts, status, uniqueness, cap, `added_by`, privacy filters is new. |
| 6.6 | Find brands | **P** | Status = item 2's `pitchSummaryFor` per row; needs a set-based version (§7). |
| 6.7 | Brand overview and product detail | **P** | Published rule and image/size sources identified (D9, D10). |
| 6.8 | Profile tabs | **P** | See A1–A9 rows. |
| 6.9 | List and profile states | **P (item 2)** | `Skeleton`, `LoadError`, `SaveBar`, `useToast`, `useUnsavedGuard`, `EmptyState` exist (`components/settings/feedback.js`, `primitives.js:161`). |
| 7 | Validation messages | **M** | None of the §7 messages exist yet; item 2's pattern (`MSG` table shared word-for-word, `error.details.fields[]`) is the template. |
| 8 | Look and feel | **E (item 2)** | `settingsTokens` in `Mobile/src/theme/tokens.js` carries every §8 value incl. the seven state families; Plus Jakarta Sans bundled and linked. A segmented control does not exist yet. |

---

## 3. Link readiness (§3)

| Link | Ready? | What is missing | What item 3 exposes for the next item |
|---|---|---|---|
| **Item 1 lifecycle** | **Partly** | State lives on `campaign_influencers.status` (12 values). Family map proposed: `invited/applied` → yourMove (creator) / waiting (brand); `negotiating/deferred` → waiting; `accepted/contracted/active` → active; `completed` → completed; `declined/rejected_by_brand/slots_filled` → declined; `expired` → ended; disputed does not exist on the assignment (contracts have `disputed`). "Completed" is derivable only as `status='completed'`, written by the escrow job (`tranche-3-release.job.js:96-101`); no `completed_at`. | `collaborationsWithYou[].stateFamily` and `completedCollaborations` computed by one shared `collabState.familyOf(status)` helper item 1 can later replace. |
| **Item 2 settings & eligibility** | **Ready, with one performance gap** | Service (`collabEligibility.service.js`), `inviteSummary`/`pitchSummary`, blocks, reference lists, `StateCityPicker`, `PickerSheet`, `useToast`, `settingsTokens`, minimal X1/X4 screens all exist as the prompt lists. Per-creator functions run 4–6 queries each. | A set-based `statusForCreators(brandId, ids[])` and `statusForBrands(influencerId, ids[])` returning `Map<id, status>` in one query each (§7), used by Discover, groups and Find brands and reusable by G8–G9. |
| **Item 4 campaigns** | **Ready to feed** | Campaigns tab placeholder; group detail endpoint returns member ids. | `GET /brands/me/influencer-groups/:id?page=all` returns `memberIds[]` for the campaign wizard. |
| **Item 5 invitations** | **Partly** | `DiscoverList` select mode is designed in from the start (G5 uses it). "Already invited to this set" = `campaign_influencers WHERE set_id AND influencer_id` — but the **cross-set bug is real**: `invite` refuses any creator with any row in another set of the same campaign, with **no status filter** (`campaign.controller.js:1268-1277`), while `duplicateSet` (`:921-945`) and open-group publish (`:254-260`) create exactly that state. Group invites will hit it on the first campaign with two sets. Item 5 must make the check status-aware (ignore `declined/expired/rejected_by_brand/slots_filled/deferred`) or scope it to the set. | Bulk status helper above; `memberIds[]`; the disabled buttons' toasts. |
| **Item 8 pitches** | **Ready to feed** | Placeholders. Find brands is the entry point; row status uses the same `canCreatorPitchBrand` semantics. | `BrandList` component and `find-brands` endpoint; O1 Pitch button toast. |
| **Items 9/17 Wallet** | Placeholder | Payment & tax stays in My Profile (existing card `ProfileScreen.js:518-590`). | — |
| **Item 13 posts / Brand Store** | **Ready to feed** | `creator_posts` + feed by `brand_id` exist; no grid on the phones. | `PostGrid` component with `items=[]`; endpoints already exist (`/follower/posts?brand_id=`, `/influencers/me/posts`). Flag: no GIN index on `scoped_brand_ids`. |
| **§16A stores / share links** | Awareness | The shopper brand store is `/business/:brand_id/store` (`follower.service.js:536+`); posts come from the feed. Nothing in item 3. | — |
| **Item 19 Home** | Placeholder | — | — |
| **Brand website** | **Shared data, three touch points** | Website creator search (`/influencers/search`) keeps its endpoint; approved-only filter will hide pending creators there (desired). Website creator detail keeps `/influencers/:id` (fields only added). Website groups UI keeps working against the extended endpoints. Website brand profile page edits branches in JSON — after the branch table it must stop editing branches (or keep editing them with no effect). | See §6 callers. Founder Q13. |
| **Admin** | **Partly** | Approval = `users.status` via `PATCH /admin/brands/:id/status` (`admin.controller.js:112-197`) and `POST /admin/creator-verifications/:id/verify` (`creatorVerification.controller.js:122-128`). Admin reads no branches and still filters by free-text city/niche (`admin/influencers/page.js:89-108`), not the reference codes. Auto-added cities are distinguishable by `ref_cities.source='google'` + `created_at`. | Nothing admin-facing in item 3. |
| **Listing engine** | **Ready** | Published rule, images, sizes, count, path all identified (D9, D10). | A11 endpoints. |
| **Social measurement** | **Partly** | Filled at register/rescrape only; YouTube unmeasured; timestamps exist. | `measuredAt` field. A refresh job is out of scope. |
| **Google Places** | **Ready, plus one service** | Details already return city/state/pincode. | `POST /places/resolve` (A3). |
| **File uploads** | **Ready** | Presigned PUT flow (`storage.service.js:54-78`), served via presigned GET (`avatarResolver.js`, 6 h) or `/media/assets/:id` redirect; `react-native-image-picker` in the binary and in use (`ProfileScreen.js:277`). | Brand logo upload (A1) on the same pattern. |

---

## 4. Privacy check — leaks found today

| # | Leak | Where | Fix |
|---|---|---|---|
| 1 | **Brand street address to any signed-in user** (`address_line`). | `brand.controller.js:997` in `GET /brands/:id/public`. | Remove from the select (A10). |
| 2 | **Every branch's phone and address to unauthenticated shoppers**: the whole `listing_data` (incl. `branches[]`) is returned by the public brand store. | `follower.service.js:745`. | Whitelist the `listing_data` keys the store needs; never return `branches`. (Outside item 3's screens but the branch table makes it moot only if the key is also stripped.) |
| 3 | **Pending creators shown to brands** by search, and reported as verified by the detail endpoint. | `influencer.controller.js:604-605` (no status filter), `:843-845` (hardcoded `TRUE`). | `u.status='approved'` on both. |
| 4 | Find-brands facets read the retired `brands.accepts_proposals`, so the creator app could offer a filter that disagrees with the list. Not a data leak, a drift. | `proposal.service.js:252`. | Rewrite with the new endpoint. |
| ✓ | Creator profile to a brand: **no email, no phone** (`influencer.controller.js:852-862` admin-only), no settings, no blocks (item 2 test `item2-settings-api.test.js:230-236`). Search rows: no private columns (verified column list, `:722-778`). Discover-brands: no thresholds since item 2. | — | Keep the item-2 privacy test and extend it to every new endpoint. |

---

## 5. Proposed migrations (additive; next free number is **170**)

### 170_item3_brand_profile_and_creator_city.sql
```sql
ALTER TABLE brands ADD COLUMN IF NOT EXISTS about text CHECK (about IS NULL OR char_length(about) <= 200);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS contact_person text;
UPDATE brands SET contact_person = listing_data->>'contact_person_name'
 WHERE contact_person IS NULL AND NULLIF(trim(listing_data->>'contact_person_name'),'') IS NOT NULL;   -- 1 row today

-- creator city: canonical id, filled by name where the typed city is on the list
UPDATE influencers i SET city_id = rc.id
  FROM users u, ref_cities rc
 WHERE u.id = i.user_id AND i.city_id IS NULL AND rc.name_norm = lower(trim(COALESCE(i.city, u.city)));   -- 22 of 25 today

-- creator niche: the four legacy values are the item-2 codes with a capital letter
UPDATE influencers SET niche = ARRAY[lower(niche[1])]
 WHERE cardinality(niche) = 1 AND lower(niche[1]) IN (SELECT code FROM ref_creator_niches) AND niche[1] <> lower(niche[1]);   -- 22 rows

-- cities: no duplicates under concurrency; a state alias table for Google spellings
CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_cities_state_norm ON ref_cities (state_id, name_norm);
CREATE TABLE IF NOT EXISTS ref_state_aliases (alias_norm text PRIMARY KEY, state_id smallint NOT NULL REFERENCES ref_states(id));
INSERT INTO ref_state_aliases VALUES ('nct of delhi', (SELECT id FROM ref_states WHERE name='Delhi')), ('national capital territory of delhi', …) ON CONFLICT DO NOTHING;
```
Dry-run checks: `brands`/`influencers` row counts unchanged; `contact_person` set = 1; `city_id` set = 22, unmatched listed (`Delhi` ×2, `Ongole`); niche rows lower-cased = 22, rows still not matching = 3 (empty) → 0 unknown codes.

### 171_item3_brand_branches.sql
```sql
CREATE TABLE IF NOT EXISTS brand_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  google_place_id text,
  formatted_address text,
  pincode text,
  lat numeric(10,6), lng numeric(10,6),
  city_id integer REFERENCES ref_cities(id),
  state_id smallint REFERENCES ref_states(id),
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_branches_one_main ON brand_branches (brand_id) WHERE is_main;
CREATE INDEX IF NOT EXISTS idx_brand_branches_brand ON brand_branches (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_branches_city ON brand_branches (city_id);
-- backfill 1: JSON branches → rows (name, address, pincode, city/state matched by name; unmatched keep NULL ids)
-- backfill 2: brands with no JSON branch → one main branch from users.city/state, brands.address_line/pincode/lat/lng
```
Dry-run checks: every brand ends with exactly one main branch; branch rows = JSON branches + brands without any; unmatched cities listed (today: `Karnal`, and one brand with no city at all → main branch with NULL city, flagged on A1).

### 172_item3_groups.sql
```sql
ALTER TABLE influencer_group_members ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES users(id);
ALTER TABLE influencer_groups ADD CONSTRAINT influencer_groups_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 40) NOT VALID;  -- validated after the dry run confirms all 7 pass
CREATE UNIQUE INDEX IF NOT EXISTS uq_influencer_groups_brand_lower_name ON influencer_groups (brand_id, lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_influencer_group_members_influencer ON influencer_group_members (influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_groups_brand_updated ON influencer_groups (brand_id, updated_at DESC);
```
Dry-run checks: 7 groups, 28 members unchanged; 0 names over 40; 0 case-insensitive duplicates per brand (verified today).

### 173_item3_discovery_indexes.sql
```sql
CREATE INDEX IF NOT EXISTS idx_users_status_role ON users (status, role);
CREATE INDEX IF NOT EXISTS idx_influencers_followers ON influencers (followers_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_influencers_engagement ON influencers (engagement_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_influencers_city_id ON influencers (city_id);
CREATE INDEX IF NOT EXISTS idx_influencers_niche_gin ON influencers USING gin (niche);
CREATE INDEX IF NOT EXISTS idx_influencers_language_gin ON influencers USING gin (language);
CREATE INDEX IF NOT EXISTS idx_influencers_handles_lower ON influencers (lower(instagram_handle), lower(youtube_handle));
CREATE INDEX IF NOT EXISTS idx_brands_sub_categories_gin ON brands USING gin (sub_categories);
CREATE INDEX IF NOT EXISTS idx_creator_posts_scoped_brands_gin ON creator_posts USING gin (scoped_brand_ids);   -- for item 13
```
All `IF NOT EXISTS`, no row changes. At 25 creators and 9 brands these are for correctness of the plan, not today's speed.

---

## 6. Proposed endpoints

Envelope and error shape as item 2 (`{success,data}` / `error:{code,message,field,details.fields[]}`). Every §7 message is returned word for word.

| Endpoint | Request | Response | Errors | Existing callers affected |
|---|---|---|---|---|
| `GET /v1/brands/me` (extended) | — | + `about, website_url, instagram_handle, contact_person, login_phone`, `branches:[…]` (from the table), `main_city` | — | brand-web profile page reads `brand.phone` for the main branch → after the table it should stop writing `branches` into `listing_data` (small website change, Q13). |
| `PATCH /v1/brands/me` (extended) | + `about, website_url, instagram_handle, contact_person` | as GET | `NAME_REQUIRED` "Enter your brand name.", `CONTACT_REQUIRED` "Enter a contact person.", `ABOUT_TOO_LONG` "Keep it under 200 characters.", `SUB_CATEGORIES_REQUIRED` "Pick at least one sub-category." | none broken (additive). |
| `POST /v1/brands/me/logo/upload-url` / `DELETE /v1/brands/me/logo` | `{content_type}` | `{key,url,method}`; save via `PATCH {logo_key}` | `LOGO_TYPE_SIZE` "Upload a JPG or PNG under 5 MB." | — |
| `GET/POST /v1/brands/me/branches`, `PUT/DELETE /v1/brands/me/branches/:id`, `POST …/:id/make-main` | `{name, place_id, is_main}` | `{branch:{id,name,formattedAddress,pincode,lat,lng,cityId,cityName,stateId,stateName,isMain}, cityAdded}` | `BRANCH_NAME_REQUIRED` "Enter a branch name.", `BRANCH_ADDRESS_REQUIRED` "Search and pick your branch address.", `MAIN_BRANCH` "The main branch can't be removed. Make another branch the main one first." | — |
| `POST /v1/places/resolve` | `{place_id, session}` | `{formattedAddress,pincode,lat,lng,city:{id,name,added},state:{id,name}}` | `PLACE_NOT_FOUND`, `STATE_UNKNOWN` (Q9) | — |
| `PATCH /v1/influencers/me` (extended) | + `place_id` (city), `bio` ≤150, `youtube_handle` (handle or URL) | + `city_id, city_name, state_name, measured_at` | `NAME_REQUIRED` "Enter your full name.", `BIO_TOO_LONG` "Keep it under 150 characters.", `CITY_REQUIRED` "Search and pick your city.", niche errors as item 2 → "Pick your niche to save." | Mobile ProfileScreen (rebuilt anyway). |
| `GET /v1/brands/me/discover-creators` | `search, openOnly=1, nicheCodes[], minInstagram, minYoutube, minEngagement, cityIds[], languageCodes[], aims[], modes[], sort=followers|engagement|newest, page, countOnly, withGroups=1` | `{total, page, rows:[{id,name,avatarUrl,nicheCode,nicheLabel,cityName,stateName,languages[],instagram,youtube,engagement,measuredAt,acceptedAims[],acceptedModes[],status,groupIds[]}]}` | — | new |
| `GET /v1/influencers/search` (unchanged shape) | — | — | — | add `u.status='approved'` only; website keeps working, pending creators disappear from it. |
| `GET /v1/influencers/:id` (extended) | — | + `measuredAt, cityName, stateName, completedCollaborations, collaborationsWithYou:[{campaignName,setName,aim,signedAt,status,stateFamily}], groups:[{id,name}]`; 404 for non-approved creators when the caller is a brand | — | website + admin pages keep their fields. |
| `GET /v1/brands/me/worked-with?search&page` | — | `{total, rows:[{influencerId,name,avatarUrl,collaborations,lastSignedAt}]}` | — | new |
| `GET /v1/brands/me/influencer-groups` (extended) | — | rows + `memberCount, openCount, updatedAt, changed (bool), avatars:[url×4]`, sorted `updated_at DESC`; existing `members[]`/`influencer_ids[]` kept for the website | — | brand-web GroupsManager keeps working. |
| `POST … /influencer-groups`, `PATCH …/:id` | `{name}` | `{group}` | `NAME_REQUIRED` "Enter a group name.", `NAME_TOO_LONG` "Keep it under 40 characters.", `NAME_TAKEN` "You already have a group with this name." | website create/rename get the new 422s (it already shows `error.message`). |
| `GET …/influencer-groups/:id?page` | — | `{group:{id,name,memberCount,openCount,updatedAt}, members:{total,rows:[{influencerId,name,avatarUrl,nicheLabel,cityName,instagram,status,addedAt}]}}` | 404 for another brand's group | new |
| `POST …/:id/members` (extended) | `{influencer_ids[]}` | `{added, skipped, capacityLeft}` | `GROUP_FULL` "{Group} is full (100 creators). Remove someone or use another group.", `NOT_APPROVED` | website add-members reads nothing from the body → unaffected. |
| `GET …/influencer-groups/for-creator/:influencerId` · `PUT` same `{groupIds[]}` | — | `{groups:[{id,name,memberCount,contains}]}` / `{added:[…],removed:[…]}` | `GROUP_FULL` | new |
| `GET /v1/influencers/me/find-brands` | `search, canPitchOnly=1, categoryCodes[], cityIds[], aims[], modes[], sort=newest|az|products, page, countOnly` | `{total, rows:[{id,logoUrl,name,subCategories[],mainCity,acceptedAims[],acceptedModes[],status,productCount}]}` | — | new; `discover-brands` stays for now (FindPartyScreen is deleted). |
| `GET /v1/brands/:id/public` (extended, address removed) | — | `{brand:{id,name,logoUrl,category,subCategories,about,mainCity,branchCount,branchCities[],websiteUrl,instagramHandle,productCount}, products:{total,rows[first 4]}, posts:{total:0,rows:[]}, pitchSummary, isOwner}` | 404 for non-approved brands unless owner | Mobile BrandOverviewScreen (rebuilt). |
| `GET /v1/brands/:id/products?page` · `GET /v1/brands/:id/products/:productId` | — | list: `{total, rows:[{id,name,price,imageUrl,outOfStock}]}`; detail: `{id,name,brand:{id,name},categoryPath,price,images[],sizes:[{size,available}],description}` | 404 when unpublished/foreign | new |
| Reference (item 2) | + `GET /v1/reference/cities?ids=` | `{items:[{id,name,stateId,stateName}]}` | — | — |

**Privacy rules 1–5** are enforced by a single response-shaping layer per audience (`toBrandViewOfCreator`, `toCreatorViewOfBrand`) and a test that asserts no forbidden key (`email, phone, gstin, address, visit_city, min_fee, min_commission, block, proposal_filters, listing_data`) appears in any A5/A6/A9/A10/A11 body.

---

## 7. Performance plan

**Discover creators (one query, page of 20, plus one count).**
```sql
WITH base AS (
  SELECT i.id, u.name, i.full_name, i.niche[1] AS niche_code, i.city_id, i.language, i.followers_count,
         i.youtube_subscribers, i.engagement_rate, i.instagram_handle, i.youtube_handle, i.profile_image_r2_key,
         GREATEST(i.scrape_last_run, i.youtube_scrape_last_run) AS measured_at, u.created_at AS approved_order,
         COALESCE(s.open, true) AS open, COALESCE(s.accepted_aims, '{conversion,engagement,hybrid}') AS aims,
         COALESCE(s.accepted_modes, '{visit,shipment}') AS modes, s.brand_category_codes,
         EXISTS (SELECT 1 FROM collab_blocks cb WHERE cb.blocker_type='creator' AND cb.blocker_id=i.id
                    AND cb.blocked_type='brand' AND cb.blocked_id=$brand) AS blocked_us
    FROM influencers i JOIN users u ON u.id=i.user_id
    LEFT JOIN creator_invitation_settings s ON s.influencer_id=i.id
   WHERE u.status='approved' AND u.role='influencer')
, scored AS (
  SELECT b.*, CASE WHEN NOT b.open OR b.blocked_us THEN 'NOT_ACCEPTING'
                   WHEN b.brand_category_codes IS NOT NULL AND cardinality(b.brand_category_codes)>0
                        AND NOT (b.brand_category_codes && COALESCE($brand_subs,'{}')) THEN 'NOT_MATCHING'
                   ELSE 'OK' END AS status FROM base b)
SELECT … FROM scored WHERE (…filters…) ORDER BY … LIMIT 20 OFFSET $off;
```
The same `scored` CTE with `SELECT count(*)` gives the live count; `countOnly=1` runs only that. Filters map directly: niche `= ANY`, followers `>=`, engagement `>= AND NOT NULL`, city `city_id = ANY`, languages `&&`, aims `&&`, modes `&&`, search `ILIKE` on name / `lower(instagram_handle)` / `lower(youtube_handle)` with the `@` stripped. Sorts: `GREATEST(followers_count, youtube_subscribers) DESC NULLS LAST`, `engagement_rate DESC NULLS LAST`, `approved_order DESC`. Indexes from migration 173.

**Group counts.** Open-to count per group = the same CASE over `influencer_group_members ⋈ base` grouped by `group_id`, one query for the whole group list; member status for a group detail page = the same CTE restricted to that group's members. Never stored.

**Find brands.** Mirror CTE over `brands ⋈ users LEFT JOIN brand_pitch_settings` with `blocked_me`, plus the creator's private-filter checks expressed in SQL (niche overlap, either-platform followers, engagement, languages, `city_id = ANY(city_ids)`) and the past-creators override as an `EXISTS` on signed contracts. `productCount` = `COUNT(*) FILTER (WHERE is_active AND pushed_to_store)` in a lateral join; `cityIds` filter = `EXISTS (brand_branches WHERE city_id = ANY)`.

**Bulk for item 5.** Expose `statusForCreators(brandId, ids[])` (the `scored` CTE with `WHERE i.id = ANY($ids)`) so 100 members cost one query, not 400–600. Set-level checks (aim, mode, visit cities, minimums) stay in item 2's per-creator function, which item 5 can run only for the members that passed the brand-level stage.

**Page size 20, infinite scroll, `total` on the first page only** (later pages send `countOnly=0`).

---

## 8. Frontend plan

### 8.1 Both apps — navigation and shell
- `BrandNavigator.js`, `InfluencerNavigator.js` → `createBottomTabNavigator` with one native stack per tab (the pre-cut pattern at `5e04e1c^`: `screenOptions` tab bar, `MaterialCommunityIcons`). Register every deep screen in the stack that reaches it; never the same route name twice inside one stack.
- `components/shell/`: `TabBar` styling from `settingsTokens`, `SegmentedControl` (surface bg, white selected segment, four segments fit 360 px: 11.5-px labels, no icons), `ComingSoonScreen` (title, line, button).
- **Native modules:** none new. `@react-navigation/bottom-tabs ^6.5.20` is JS; `react-native-screens ^3.31.1`, `react-native-safe-area-context ^4.10.5`, `react-native-vector-icons ^10.0.3`, `react-native-image-picker ^7.1.2` are in `package.json:17-36`, autolinked (`android/settings.gradle`), and in the shipped APK (`NATIVE_RUNTIME='3'`, `otaUpdater.js:28`). Places is server-side, so `react-native-maps` is not needed. **OTA-safe, no runtime bump.**

### 8.2 Reusable components (new unless noted)
`DiscoverList` (props: `mode='browse'|'select'`, `filters`, `selectedIds`, `disabledIds`, `capacityLeft`, `onOpen`, `onAddToGroup`) · `FiltersSheet` (creator and brand variants, live count) · `CreatorCard` · `BrandCard` · `AvatarStack` · `MemberRow` · `CheckboxRow` · `StatusChip` (item 2, extended with the three Discover chips) · `ProductGrid` + `ProductCard` · `ImageCarousel` · `PostGrid` (empty now) · `StatTriple` ("48.2K / — / 4.2%") · `HandleTag` (opens IG/YT) · `PlaceSearchField` (autocomplete → resolve) · `LogoPicker` / `PhotoPicker` (image-picker → upload-url → PUT → save key). Reused from item 2: `PickerSheet`, `StateCityPicker`, `ConfirmSheet`, `ActionSheet`, `SaveBar`, `useToast`, `Skeleton`, `LoadError`, `EmptyState`, `Chip`, `Tag`, `SettingRow`, `useUnsavedGuard`, `copy.js` pattern.

### 8.3 Brand app files
| Add | Change |
|---|---|
| `screens/brand/BrandProfileListScreen.js` (A1), `BrandBusinessDetailsScreen.js` (A2), `BrandSubCategoriesScreen.js` (A3), `BrandBranchesScreen.js` (A4), `BrandBranchEditScreen.js` (A5), `BrandCreatorsScreen.js` (D1 segments), `BrandWorkedWithScreen.js` (D5), `BrandGroupsScreen.js` (G1–G3), `BrandGroupDetailScreen.js` (G4/G7), `BrandGroupAddCreatorsScreen.js` (G5), `components/groups/AddToGroupSheet.js` (G6), `BrandOwnOverviewScreen.js` (O4) | `BrandCreatorProfileScreen.js` (P1–P4: complete), `BrandPitchSettingsScreen.js` (unchanged, linked from A1), `BrandNavigator.js`; **delete** `screens/shared/FindPartyScreen.js` and the old `BrandProfileScreen.js` form. |

### 8.4 Creator app files
| Add | Change |
|---|---|
| `screens/influencer/MyProfileListScreen.js` (A7), `ProfileInfoScreen.js` (A8), `NicheLanguagesScreen.js` (A9), `PaymentTaxScreen.js` (existing card moved behind a row), `CollabsScreen.js` (F1), `FindBrandsScreen.js` (F2/F3), `ProductDetailScreen.js` (O3) | `BrandOverviewScreen.js` (O1/O2: complete), `InvitationSettingsScreen.js` (unchanged), `InfluencerNavigator.js`; **delete** the old `ProfileScreen.js` inline form and its decorative notifications switch. |

### 8.5 Brand website
No new website screen. Three small edits so item 3 does not break it: stop writing `branches` into `listing_data` on `settings/profile/page.js` (or hide the branch editor with a note that branches are managed in the app, Q13); read the new 422 codes on group create/rename (already shows `error.message`); nothing on the creator search or detail pages.

---

## 9. Test baseline and plan

**Baseline at `2d3934b` (full backend suite, run 2026-09-11):** 100 suites, **474 failed / 562 passed / 1036 tests**. The failures are pre-existing; 832 of the failure messages are the test factory registering brands as `restaurant`, refused by the fashion-only gate since 2 September. Mobile: 29 suites / 388 tests, all passing.

**Existing tests touching endpoints item 3 changes:** `backend/tests/influencer-search.test.js` (search + `/influencers/:id`, incl. a sensitive-fields assertion at `:254`), `brand-search-real-people.test.js` (onboarded-only gate), `influencer.test.js` (`/me`), `brand.test.js`, `item2-settings-api.test.js` (`inviteSummary`, `pitchSummary`, `/brands/:id/public`), `campaigns.test.js` (invite), `admin-creator-review.test.js`, `admin-account-review.test.js`. **No test covers the six group routes.**

**Phase 4 tests to add:** `item3-branches.test.js` (table, one main, place resolve, city auto-add incl. a concurrent double insert, backfill), `item3-profile.test.js` (about/contact/bio/name/city rules, logo and photo type+size, niche and city backfills, YouTube normalisation), `item3-discover.test.js` (approved-only, statuses incl. blocked == paused, every filter, search by handle with `@`, sorts, count == list, page size), `item3-groups.test.js` (name rules incl. case-insensitive duplicate, cap 100 and the 101st, bulk add skips, for-creator set, 404 for another brand, delete leaves `campaign_influencers/contracts/influencer_proposals` untouched, suspended creator drops out, open count moves on the next load), `item3-worked-with.test.js` (both signatures only), `item3-brand-overview.test.js` (no address/GSTIN/phone/contact/offers, published-only products, out-of-stock rule, product detail 404s, `isOwner`), `item3-find-brands.test.js`, `item3-privacy.test.js` (forbidden-key sweep over every new response). Mobile: render tests per screen state, segmented control width, DiscoverList select mode.

---

## 10. Questions for the founder

Plain language, each with a recommendation so a "yes" is enough.

1. **"Most followers" sort** = the higher of Instagram followers and YouTube subscribers. *Recommend yes.*
2. **Aims and Mode filters in Discover** match creators who accept **at least one** of the selected values. *Recommend yes.*
3. **Discover and group statuses are brand-level only** (paused or blocked, then category match). Set-level rules come with item 5. *Recommend yes.*
4. **Creators your brand has blocked.** A brand's block only stops that creator from pitching you. *Recommend they appear normally in Discover and groups, with a small grey "Blocked by you" label so you are not surprised later; no other behaviour changes.*
5. **"Completed collaborations on INFLX".** Today the system marks a collaboration completed only when the last payment is released, so a commission-only collaboration is never marked completed (1 of 8 assignments is "completed" today). *Recommend: count what the system marks completed now, and let item 1's lifecycle work extend the rule to "required post live" for Pay for Sale. The number will be low until then.*
6. **"Out of stock".** Stock is a number the brand types; nothing reduces it on sale. *Recommend: a product is out of stock when its stock is 0, or when it has sizes and every size's stock is 0; a size is unavailable when its stock is 0. Blank means available.*
7. **Which size list to read.** The website wizard writes sizes into one structure; the other size table has zero rows. *Recommend reading the wizard's structure.*
8. **Existing typed cities.** Match by name; list the rest for review, never auto-add. Today: brand cities match 7 of 9 (Karnal and one blank); creator cities match 22 of 25 (Delhi twice, Ongole once). *Recommend yes, and add "Delhi" as a city under the Delhi state in the seed so the two Delhi creators match.*
9. **A Google state not on the list.** *Recommend adding the state automatically as well, marked `source = google`, with a small alias table for Google's spellings (for example "NCT of Delhi" → Delhi). The list is meant to grow.*
10. **Removing a branch with planned shoots.** Shoot addresses are typed into the shoot plan itself and never point back to a branch, so removing a branch changes nothing already planned. *Recommend allowing it, with the confirm text as mocked.*
11. **Accounts removed from INFLX.** No account deletion exists today; the only in-product state is "suspended" set by admin. *Recommend: a creator who is suspended or rejected is dropped from every group at that moment, and group lists never show a non-approved creator even if a row slipped through. Real deletion is a separate item.*
12. **Brand users.** A brand has exactly one login today, so "all of a brand's users" is one person. *Recommend building groups per brand (not per user) so extra logins later need no change.*
13. **Brand website and branches.** The website profile page edits branches as free text inside the brand record. Once branches move to their own table, that editor would silently do nothing. *Recommend hiding the website's branch editor with a note "Branches are managed in the Brand app" (as we did for pitch settings), and keeping the rest of the website profile page.*
14. **Pending creators on the website.** The website's creator search currently shows creators who are not yet approved. Making search approved-only (as the rules require) removes them from the website too. *Recommend yes.*
15. **Existing "Shortlist" on the website.** The website already has a groups feature under the name "Shortlist", with 7 groups and 28 members in production. *Recommend keeping it working against the same groups, renamed "Groups" later; item 3 does not touch its screens.*
16. **Photo and logo size.** Files go straight from the phone to storage, so the server can only check the size after the fact. *Recommend the app refuses files over 5 MB before uploading, and the server double-checks the stored size when the key is saved and rejects it if larger.*
17. **Instagram engagement only.** The engagement filter and the "Engagement" stat use the Instagram rate; YouTube has none. *Recommend yes (same as item 2).*
18. **YouTube numbers are unmeasured for everyone today** (0 of 25), and Instagram numbers were last measured at sign-up for 22 of 25 creators. Item 3 shows "—" and the date honestly. *Recommend a separate small item for a weekly refresh; not part of item 3.*
19. **Group invites will hit a known bug.** Inviting a creator who already sits in another set of the same campaign is refused today even if she declined or expired there. *Recommend item 5 fixes that check; item 3 only records it.*

Then **stop and wait for approval.**
