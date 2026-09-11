# item3-discovery-profiles-groups — impact

**Verdict: production-impacting.** Five migrations (170–174), backend changes read by the website and the
shopper app, and two OTA bundles. Explicit go required before push; migrations applied first.

## Database (all additive; dry run clean on 2026-09-11)
- 170 seed: `ref_states` 17 → 36, `ref_cities` 63 → 92 (`source='seed'`, `state_sort` continues from 18).
- 171: `brands.about/website_url/instagram_handle/contact_person`; `ref_state_aliases` (13);
  `ref_unknown_states`; unique `(state_id, name_norm)` on cities; creator `city_id` backfill (25/25
  matched after the CSV); 22 capitalised niches lower-cased.
- 172: `brand_branches` with one main branch per brand (9/9); one brand's main branch has no city
  ("Hotel Village": its account never had a city) — shows the A1 reminder.
- 173: group name length CHECK (validated), per-brand unique lower(name), `added_by`.
- 174: indexes for Discover / Find brands / groups, GIN on `creator_posts.scoped_brand_ids`.
- Rows never touched: campaigns, sets, invitations, contracts, proposals, wallets.

## Backend — new
Discovery routes (`/brands/me/discover-creators`, `/brands/me/worked-with`, branches CRUD + make-main,
`/influencers/me/find-brands`, `/brands/:id/products[/:productId]`, `/places/resolve`,
`/reference/cities`), group routes for one creator, services `discovery`, `brandBranches`,
`brandProducts`, `collabState`, `referenceLists.resolvePlace`, `storage.headObject`.

## Backend — changed (superset responses; rules apply to every caller)
- `/brands/me`: + `branches`, `mainCity`, `needsSubCategories`, `needsMainCity`, `login_phone`,
  `business_phone`. `PATCH` validates name/contact/about/links/logo.
- `/brands/:id/public`: **address removed**; + about, sub-categories, main city, branch cities (names
  only), links, product count, first products, `isOwner`; 404 for non-approved brands to others.
- `/influencers/me`: + `city_id/city_name/state_name/measured_at/needsNiche`; `PATCH` accepts `place_id`,
  validates name/bio, re-checks the photo object.
- `/influencers/search`: approved only, no hard-coded verified flag. `/influencers/:id`: 404 for brands
  when not approved; + city names, measured-at, signed count, collaborations with the brand, groups,
  `blockedByYou`.
- Group routes: name rules, cap 100, approved-only membership, `memberCount/openCount/avatars/…` added,
  old keys kept.
- Shopper store: `listing_data` whitelisted (no branches/phones/addresses). Find-brands facets: no
  `accepts_proposals`. Brand registration now seeds the Main Branch row.

## Phone apps (OTA, native runtime 3, no new native modules)
Brand: tab shell + 12 screens (3 rewritten, 9 new). Creator: tab shell + 8 screens (3 rewritten,
5 new). Deleted: `FindPartyScreen`, `BrandPitchesPlaceholderScreen`, the inline profile forms and the
notifications switch. Item 2 screens unchanged except B6 "Open pitches" now lands on Creators → Pitches.

## Website side effects (no website code changed) — see `06-diff/notes.md`
Creator search stops listing pending creators; the branch editor's `listing_data.branches` no longer
drives branches; "Shortlist" obeys the group rules; group counts exclude suspended creators; brand
detail pages lose the public street address; store pages lose `listing_data.branches`.

## Risk and rollback
- Migrations are additive; nothing is dropped. Rolling back = deploying the previous commit; the new
  columns and tables stay unused.
- The one behavioural risk to older callers is the approved-only rule on creator search/detail — it is
  the founder's Q14 decision and a privacy requirement.
- OTA rollback = republish the previous bundle (brand 210 / influencer 198).
