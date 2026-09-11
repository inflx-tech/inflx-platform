# item3-discovery-profiles-groups — workflows

Each workflow names the screen from the locked mockups, the endpoint it calls and its end state.

## W1 — Brand sets up its profile (A1 → A2/A3/A4/A5)
1. Brand opens Profile. `GET /brands/me` → `{brand, branches, mainCity, needsSubCategories, needsMainCity}`.
   Header "Fashion · {mainCity}" (or "Fashion"); orange reminders when either flag is true.
2. Business details: edits name / about / contact / GSTIN; picks a logo (app refuses > 5 MB or non
   JPG/PNG) → `POST /brands/me/media-assets/upload-url` → PUT to storage → `POST /brands/me/media-assets`
   → `PATCH /brands/me {logo_asset_id}` (server re-checks size/type → 422 "Upload a JPG or PNG under 5 MB.").
   Save → `PATCH /brands/me` → back to A1 with the toast "Saved.".
3. Sub-categories: chips → `PATCH /brands/me {sub_categories}`; none selected → "Pick at least one sub-category."
4. Branches: list `GET /brands/me/branches`. Add: name + Google address → `POST /brands/me/branches
   {name, place_id}`; the server resolves the place (state via name or alias; city matched or added with
   `source='google'`); response `{branch, cityAdded}`; toast "{City} is new on INFLX…" when added.
   Unknown state → 422 `STATE_UNKNOWN` shown under the field. Make main → `POST …/:id/make-main`. Remove
   main → 422 with the exact message; remove other → 200.
   End state: exactly one main branch; `users.city/state` and `brands.lat/lng/address` follow it.

## W2 — Brand discovers creators (D1/D2 → P1–P4)
1. Creators tab → Discover: `GET /brands/me/discover-creators?openOnly=1&sort=followers&page=1`.
2. Search / filters / sort change the query; the filter sheet asks `…&countOnly=1` for the button count.
3. Tap a card → `GET /influencers/:id` (brand caller) → P1/P2/P3/P4 by `inviteSummary.reason` and
   `blockedByYou`. Invite → toast "Inviting creators comes with campaigns. Coming soon." Add to group →
   W3 step 4. ⋯ → Block (confirm, undo toast) / Unblock.
   End state: no write except blocks; a blocked creator stays visible with the chip.

## W3 — Brand keeps groups (G1–G7)
1. Groups segment: `GET /brands/me/influencer-groups` → cards sorted by updated_at.
2. New group: G3 sheet → `POST /brands/me/influencer-groups {name}` (422 with the exact message on empty,
   > 40 or duplicate) → opens G4.
3. Add creators: G5 → `GET …/:id?page=all` (member ids, capacityLeft) → select from Discover (select
   mode) or Worked with → `POST …/:id/members {influencer_ids}` → `{added, skipped, capacityLeft}`;
   over the cap → 422 `GROUP_FULL` "{Group} is full (100 creators). Remove someone or use another group."
4. From a card or profile: G6 → `GET …/for-creator/:influencerId` → tick/untick → `PUT …/for-creator/:influencerId
   {groupIds}` → `{added[], removed[]}` → toast "Added to X." / "Removed from X." / "Groups updated.".
5. Member ⋯ → View profile / Remove → `DELETE …/:id/members/:influencerId`. Group ⋯ → Rename
   (`PATCH …/:id`) / Delete (`DELETE …/:id`, confirm) → back to Groups with "Group deleted.".
   End state: `campaign_influencers`, `contracts`, `influencer_proposals` untouched; suspended members
   hidden not deleted; rejected members' rows deleted.

## W4 — Brand reviews creators it worked with (W1 segment)
`GET /brands/me/worked-with?search&page` → rows grouped per creator with the count and last signature
(both-signed contracts only, approved creators only) → tap → W2 step 3.

## W5 — Creator sets up her profile (A7 → A8/A9)
1. Profile: `GET /influencers/me` (+ `city_name`, `state_name`, `measured_at`, `needsNiche`) and the
   invitation summary. Warning row when `needsNiche`.
2. Profile info: photo → `POST /influencers/me/profile-image/upload-url` → PUT → `PATCH /influencers/me
   {profile_image_key}` (server re-checks). Name / bio / YouTube / city (`place_id`) → `PATCH /influencers/me`
   → `{influencer, cityAdded}` → back with "Saved." or the new-city toast. Errors: "Enter your full name.",
   "Keep it under 150 characters.", "Search and pick your city.", `STATE_UNKNOWN` message.
3. Niche & languages: exactly one niche → `PATCH /influencers/me {niche:[code], language}`.
4. Payment & tax: unchanged rules, on its own screen.

## W6 — Creator finds brands (F1 → F2/F3 → O1/O2/O3)
1. Collabs → Pitch a brand → Find brands: `GET /influencers/me/find-brands?canPitchOnly=1&sort=newest`.
2. Filters (`countOnly=1` for the button) and sorts change the query.
3. Tap → `GET /brands/:id/public` → O1 (OK) / O2 (banner) → Pitch → toast "Pitching brands is coming soon."
   See all → `GET /brands/:id/products?page` → product → `GET /brands/:id/products/:productId` (O3).
   ⋯ → Block brand (confirm, undo).
   End state: reads only, plus blocks.

## W7 — Coming-soon tabs (A6)
Home / Campaigns / Wallet (brand) and Home / Create / Wallet (creator) render the prompt's title, body
and button; the button jumps to Creators, Find brands or Payment & tax.

## Data flow that runs once (migrations 170–174)
Seed 22 states/UTs and 29 cities (36 / 92 after) → brand profile columns, state aliases, unknown-state log,
creator `city_id` backfill by name, lower-case niches → `brand_branches` backfilled from JSON branches
then one Main Branch per remaining brand → group name constraint (validated), per-brand unique name,
`added_by` → discovery indexes. Dry run first; the runner prints before/after counts and the unmatched list.
