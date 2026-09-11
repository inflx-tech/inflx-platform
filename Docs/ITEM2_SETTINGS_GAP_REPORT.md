# Item 2 — Pitch & Invitation Settings · Phase 1 gap report

**Date:** 2026-09-11 · **Inputs:** `INFLX_Master_Business_Rules_Phase_1_v1.9.docx` §8A (+ §5, 8, 25, 27, 31, 33), `INFLX_Item2_Settings_Mockups.html` (B1–B8, C1–C6, X1–X4), `INFLX_Item2_Claude_Code_Prompt.md`.
**Repo state read:** `main` at `ec236ca` (profile-only apps, OTA brand 209 / influencer 197). Working tree has unrelated uncommitted edits (APKs, `Packages/brand-web/app/dashboard/influencers/[id]/page.js` +25/−6, `.env.example`, three `lock.json`); none were touched.
**Status of this document:** Phase 1 survey, approved by the founder on 2026-09-11 with 17 answers (`features/item2-pitch-invitation-settings/APPROVAL.md`). Phases 2–4 were built the same day; the build record, before/after notes and test results live in `features/item2-pitch-invitation-settings/`. Rules doc v1.10 (same day) folded the answers to Q4, Q5 and Q6 into §8A.

---

## 0. Headline

| | Verdict |
|---|---|
| Brand pitch settings | **Partial.** An older on/off switch + five filters exist (`brands.accepts_proposals`, `brands.proposal_filters` JSONB), with a GET/PATCH endpoint and a live panel on the brand **website**. Different fields from §8A, no validation, and it leaks thresholds to creators. |
| Creator invitation settings | **Missing in practice.** Four columns were added in Aug (`accepts_brand_requests`, `accepted_aims`, `min_fee`, `min_commission_pct`) but **nothing writes them** (no endpoint, no screen) and the only reader was the retired pre-campaign handshake. |
| Blocks (either direction) | **Missing.** No table, no endpoint, no screen. |
| Reference lists | **Missing as data.** Niches and languages are hard-coded arrays in one phone screen. The 8 major fashion categories exist nowhere; the brand's category is the single word `fashion`. There is no state→city list; states are two divergent hard-coded arrays, cities are free text. |
| Eligibility on send | **Partial / Conflicts.** Pitch-create runs an old check with verbose, threshold-revealing messages. Invite-create runs **no** creator-side check at all. |
| Screens | **All must be built.** Both phone apps are profile-only since 2026-09-10. The brand-overview (creator app) and creator-profile (brand app) screens were deleted in that cut and are recoverable from git for reference only. |
| Theme / font | **Partial.** Plus Jakarta Sans is bundled and linked (OTA-safe). No palette matches §6; a new token set is needed. No native module is required for anything in this item. |

---

## 1. Requirement table

Status key: **E** Exists · **P** Partial · **M** Missing · **C** Conflicts (with rules doc/prompt).

### 1.1 Data (D1–D6)

| ID | Requirement | Status | Evidence (file:line) | Proposed change | Risk |
|---|---|---|---|---|---|
| D1.a | Brand `accepting` switch, default **true** | **C** | `backend/migrations/025_influencer_proposals.sql:21-22` — `brands.accepts_proposals BOOLEAN NOT NULL DEFAULT FALSE`. `155_brands_open_to_pitches.sql:36-41` flipped only brands approved by 2026-08-22; its comment (lines 30-33, 43-47) says a new brand is opened "by the approval step", but `grep accepts_proposals backend/src` finds only `proposal.controller.js:96,329-353` and `proposal.service.js:45,53` — **no approval code sets it**, so every brand approved since is closed to pitches. | New table `brand_pitch_settings` (§2) with `accepting DEFAULT true`; missing row = defaults (D5). Old column left in place, deprecated, no longer read by the new check. | Low. Additive. Brands that were explicitly paused via the old web panel become open (see Q7). |
| D1.b | `paused_at` | **M** | No column anywhere. | New column, set on off / cleared on on by the PUT handler. | — |
| D1.c | `accepted_aims` (set of 3, ≥1) | **M** for brands | Nothing on `brands`. (`influencers.accepted_aims text[]` exists — `149_precampaign_handshake.sql:90-91` — creator side only, unwritten.) | `accepted_aims text[] NOT NULL DEFAULT '{conversion,engagement,hybrid}'` + CHECK ⊆ the three and cardinality ≥ 1. | — |
| D1.d | `accepted_modes` (`visit`,`shipment`, ≥1) | **M** | No column. Code vocabulary confirmed at `165_set_carries_its_own_shape.sql:80-81` (`visit`,`shipment`,`remote`). | `accepted_modes text[] NOT NULL DEFAULT '{visit,shipment}'` + CHECK ⊆ `{visit,shipment}`. Settings never offer `remote` (see Q9 for how a `remote`/NULL set is checked). | — |
| D1.e | `niche_ids` (null = any) | **P** | Old `proposal_filters.allowed_niches` (025:25-32) — free strings, matched by lowercase name in `proposal.service.js:100-107`. | `niche_codes text[]` referencing `ref_creator_niches` (D4). | See D4.a. |
| D1.f | `min_followers_instagram` / `min_followers_youtube` | **C** | Old filter is `min_tier` (nano/micro/macro/mega) from Instagram only: `proposal.service.js:93-99,159-164`. | Two nullable integer columns ≥ 0. Either-platform rule in service. | — |
| D1.g | `min_engagement_rate` (0–100, one decimal) | **P** | Old `proposal_filters.min_engagement_rate` exists, unvalidated (`proposal.controller.js:346-348` stores any JSON). | `numeric(4,1)` nullable, CHECK 0–100. | — |
| D1.h | `language_ids` | **M** | No language filter today. | `language_codes text[]` referencing `ref_languages`. | — |
| D1.i | `city_ids` (state→city) | **C** | Old filter is boolean `city_match_required` = same city as brand's user row (`proposal.service.js:108-113`). | `city_ids integer[]` referencing `ref_cities`. | Depends on D4.d. |
| D1.j | `allow_past_creators` default true | **C** | Old `only_past_collabs` is the **inverse idea** (restrict to past creators) and uses `campaign_influencers.status IN ('active','completed')`, not signatures: `proposal.service.js:126-141`. | Boolean default true; "past" defined by D6.d. | — |
| D2.a | Creator `open` + `paused_at` | **P** | `influencers.accepts_brand_requests boolean DEFAULT true` (149:82-83). Never written: no route, no screen (grep `accepts_brand_requests` → only `handshake.service.js:49,60,216`, and the handshake routes are gone — `grep collab-requests backend/src/routes` = 0). | New table `creator_invitation_settings` (§2). Old columns left, deprecated. | Low. |
| D2.b | Creator `accepted_aims` / `accepted_modes` | **P** / **M** | `influencers.accepted_aims text[]` (149:90). No modes. | Both on the new table, same CHECKs as D1.c/d. | — |
| D2.c | `visit_city_ids` (≥1 when `visit`) default = own city | **M** | No column. Creator city is free text on `users.city` (registration writes it there — `055_fix_v_searchable_creators_onboarded_city.sql:26-32`; `InfluencerRegisterScreen.js:89-93` is a plain TextInput). | `visit_city_ids integer[]`. Default derived at read time from the creator's profile city matched to `ref_cities` by name (Q6). Server refuses a PUT with `visit` on and an empty list. | Medium: a creator whose typed city cannot be matched has no default — see Q6. |
| D2.d | `brand_categories` (subset of 8, null = any) | **M** | No column, no list. | `brand_category_codes text[]` referencing `ref_brand_categories`. | Depends on D4.c. |
| D2.e | `min_fee_engagement`, `min_fee_hybrid` (whole ₹) | **P** | Single `influencers.min_fee numeric(10,2)` (149:88-89), not per Aim, never written. | Two nullable integer columns ≥ 0. | — |
| D2.f | `min_commission` rows (aim × category, 1–100) | **P** | Single `influencers.min_commission_pct` (149:86-87). | Child table `creator_min_commissions (influencer_id, aim, category_code, pct)`; `category_code='ALL'` allowed. Rows are never deleted when an Aim or category is unselected — they are ignored by the reader (§3). | — |
| D2.g | Minimums kept when Aim turned off | **M** | n/a | Falls out of the schema: fee/commission columns are independent of `accepted_aims`. Covered by a persistence test. | — |
| D3 | Blocks, both directions, unique pair, never told | **M** | `grep -i block backend/migrations` → only two comments (067:17, 148:11). No notification code path to suppress because none exists. | Table `collab_blocks` (§2). Block/unblock endpoints call **no** notification service. | — |
| D4.a | Creator niches list (post-sign-up) | **P / C** | Stored `influencers.niche varchar(60)[]` (001:157). Options hard-coded **three different ways**: creator profile `Packages/Mobile/src/screens/influencer/ProfileScreen.js:14` (`food, fashion, beauty, travel, fitness, tech, home_decor, parenting, finance, education`); old brand filter sheet `components/brand/ProposalFiltersSheet.js:15` (7 items, different); brand-web `dashboard/influencers/page.js:1333` (another). Server accepts any value (`influencer.controller.js:480`). Sign-up asks no niche; the creator picks in Profile → Content Preferences (ProfileScreen.js:391-435), which matches the rules doc wording. | `ref_creator_niches (code, label, sort, active)` seeded from a founder-approved CSV; A8 serves it; creator profile chips read from it (small in-scope change). | **Conflict to resolve (Q4):** the list is generic-lifestyle, INFLX is fashion-only, the mockup shows fashion niches. |
| D4.b | Languages list | **P** | `influencers.language varchar(30)[]` (001:158). Options hard-coded `ProfileScreen.js:13` (10 languages, stored as labels e.g. `Hindi`). | `ref_languages (code, label)` seeded with the current 10; A8 serves it. | Low. |
| D4.c | 8 major fashion categories; brand's own category on the same list | **M** | `brands.category varchar(60) NOT NULL` (001:131) — value is `fashion` for every new brand (`businessCategory.model.js:30-34`), locked after registration (`BrandProfileScreen.js:233-234`). The listing taxonomy has segments `Men / Women / Unisex / Kids` (`095_drilldown_taxonomy_engine.sql:19-23`, `scripts/seed-fashion-taxonomy.js:23`) and the fashion schema has product sections (`public/schemas/fashion_online.json:17-25`) — both are **product** groupings, not the brand's industry. Nothing maps to `MEN … BAGS_ACCESSORIES`. | `ref_brand_categories` seeded with the 8 codes; `brands.major_categories text[]` (nullable = not yet chosen). Brand picks in Business details (small addition). Eligibility 3.2.3 reads it. | **Founder decisions (Q5):** one or many per brand (rules doc §33 leaves it open); how a brand with none set is treated. |
| D4.d | Canonical state→city list shared by branches, brand Cities filter, creator visit cities | **M** | Branches live in `brands.listing_data.branches[]` JSONB (`013_listing_engine.sql:12`; `brand.controller.js:215-232`) with **free-text** `state` and `city` (`BrandProfileScreen.js:268-272,325-329`). States are hard-coded twice and differ: `BrandRegisterScreen.js:36-46` (`Andaman & Nicobar`) vs `brand-web/app/dashboard/settings/profile/page.js:8-18` (`Andaman and Nicobar Islands`). Creator city: free text `users.city` (see D2.c). Google Places proxy exists (`services/places.service.js:1-40`) but is not used for branches. | `ref_states` + `ref_cities` seeded from a curated CSV (CSV-first). Existing typed values matched by normalised name at read time (reported, not rewritten). Pickers in this item read the list. | **Founder decisions (Q6):** source/size of the city list; whether branch and creator-city forms switch to the picker now or in item 3. |
| D5 | Existing accounts | — | 5 brands in prod (mig 155 comment); creators: real sign-ups since 2026-08-20 plus 45 scraped prospects (not eligible; `THE_CUT.md` brands see registered+verified only). | **Recommend: missing row = all defaults** (no backfill). Reasons: additive and reversible; new accounts need no hook (the mig-155 approval hook was never built — D1.a shows what happens when defaults depend on a hook); matches the existing fallback pattern in `handshakeSettings.service.js:17-20,52-68`; reporting cost is one `LEFT JOIN … COALESCE`. GET returns the effective defaults with `saved:false`; first PUT upserts. | Q7. |
| D6.a | Niches, languages, profile city | **E** | `influencer.controller.js:798-801`: `i.niche`, `i.language`, `COALESCE(i.city,u.city)`. | Read as-is; city matched to `ref_cities` by name until a `city_id` exists. | City free text (D4.d). |
| D6.b | Instagram and YouTube followers as separate numbers | **E** | `influencers.followers_count int` (001:155, Instagram); `influencers.youtube_subscribers bigint` (160:19), NULL = never measured (160:28-29). | Treat NULL as 0 for the minimum (Q16). | — |
| D6.c | Engagement rate | **E (Instagram only)** | `influencers.engagement_rate numeric(5,2)` (001:156). No YouTube rate exists. | Compare Instagram rate only (Q15). | — |
| D6.d | Previously signed agreement = both signatures | **E** | `contracts.influencer_signed_at`, `brand_signed_at` (006:26-29); creator signs at `contract.controller.js:439`, brand signs and status→`active` at `:520-524`; `contracts.campaign_influencer_id → campaign_influencers.set_id → campaign_sets.campaign_id → campaigns.brand_id`. `collab_agreements` (149:147-174) are handshake "agreed", **never signed** — excluded. | Query: `EXISTS contracts WHERE influencer_signed_at IS NOT NULL AND brand_signed_at IS NOT NULL` joined to the brand. | Q3. |

### 1.2 API (A1–A8)

| ID | Requirement | Status | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| A1 | GET/PUT brand pitch settings with §4 validation and field codes | **P / C** | `GET/PATCH /v1/brands/me/proposal-settings` — `proposal.routes.js:36-37`, `proposal.controller.js:325-358`. Old shape `{accepts_proposals, proposal_filters:{min_tier, allowed_niches, city_match_required, min_engagement_rate, only_past_collabs}}`; PATCH stores any object unvalidated (:346-348). **Live caller: brand website** `Packages/brand-web/app/dashboard/influencers/page.js:1179,1332-1353` (filter panel). Phone caller `Mobile/src/services/api.js:323-324` is dead (its screen was deleted; `components/brand/ProposalFiltersSheet.js` is orphaned). | New `GET/PUT /v1/brands/me/pitch-settings` (§3). Old routes: see Q8. | Two panels writing different data if the web panel stays live. |
| A2 | GET/PUT creator invitation settings incl. commission rows | **M** | No route under `influencer.routes.js` touches the 149 columns. | New `GET/PUT /v1/influencers/me/invitation-settings`. | — |
| A3 | Brand blocked creators list/block/unblock | **M** | — | `GET/POST /v1/brands/me/blocked-creators`, `DELETE /v1/brands/me/blocked-creators/:influencer_id`. | — |
| A4 | Creator blocked brands | **M** | — | `GET/POST /v1/influencers/me/blocked-brands`, `DELETE …/:brand_id`. | — |
| A5 | Brand overview for creator viewer + `pitchSummary` | **P / C (privacy)** | Overview endpoint `GET /v1/brands/:id/public` (`brand.routes.js:155`; `brand.controller.js:965-977`) returns name/category/logo/address/campaign count — no pitch info. **Leak:** `GET /v1/brands/:id/proposal-criteria` (`proposal.routes.js:33`; controller :94-105) returns the raw `proposal_filters` to any authenticated user, and `discover-brands` selects `b.proposal_filters` into every row (`proposal.service.js:243`). | Add `pitchSummary` to `/brands/:id/public` when the viewer is a creator. Change `proposal-criteria` to return the same coarse summary only; drop `proposal_filters` from the discover query. | Low (no live phone callers of either). |
| A6 | Creator profile for brand viewer + `inviteSummary` | **P** | `GET /v1/influencers/:id` (`influencer.routes.js:88`, brand+admin) — `influencer.controller.js:781-826` returns full stats. **Live caller: brand website** `dashboard/influencers/[id]/page.js:286`. | Add `inviteSummary` when `req.user.role==='brand'`; omit for admin. | Low, additive field. |
| A7 | Eligibility service wired into pitch-create and invite-create | **P (pitch) / M (invite)** | **Pitch-create:** `POST /v1/influencers/me/proposals` (`proposal.routes.js:24` → `proposal.controller.js:107-166`); calls `checkEligibility` at :135 (`proposal.service.js:43-157`) — mixes admin limits (ban/suspend :69-77, cooldown :80-90, rate limits :144-156) with the old brand filters (:92-141) and returns **threshold-revealing messages** (e.g. :118 "requires a minimum engagement rate of X%") as `FORBIDDEN 403`. Pitch payload has **no mode** field and `influencer_proposals` has no `shoot_mode` column (025:42-67, 138, 152). Callers today: phone `api.js:455` (screen deleted → **zero live callers**); brand-web none. **Invite-create:** `POST /v1/campaigns/:id/sets/:sid/invite` (`campaign.routes.js:47` → `campaign.controller.js:1095`); validates set/agreement/allocation/offer/budget/coupon (:1140-1300), inserts `campaign_influencers` (:1318), notifies the creator (:1438-1451). **No creator-side eligibility check exists** in 1095-1451 (grep `accepts_brand_requests|accepted_aims` in the file = 0). Callers today: **brand-web creator page** `dashboard/influencers/[id]/page.js:222` (sends only `influencer_id`; file has uncommitted local edits), `Packages/shared/api/campaign.api.js:24`, phone `api.js:295` (dead), backend tests `brief-to-signing.test.js`, `campaigns.test.js`, `coupon-not-mandatory.test.js`, `collab-spine.test.js`. | New `services/collabEligibility.service.js` (§3.4). **Pitch:** replace :92-141 with `canCreatorPitchBrand`; keep ban/suspend/cooldown/rate-limit blocks unchanged; throw `AppError(reasonCode, coarseMessage, 403, 'brand_id')`. Add nullable `influencer_proposals.shoot_mode` and accept `shoot_mode` in the payload (optional now, mandatory in item 8 — Q11). **Invite:** after `getSetOrThrow` and before any write (insert at ~:1140, before `assertValidChannels`), call `canBrandInviteCreator`; hard fail → 403 with the coarse code; warnings returned as `data.warnings[]` alongside the created row. Skip hard checks when `agreement_id` is present (Q10). | **Test suite:** defaults are all-open and missing row = defaults, so existing invite tests pass unless a set has `shoot_mode='remote'`/NULL (Q9). brand-web modal already surfaces `res.error.message` (:225) so a refusal degrades to a readable message. |
| A8 | Reference lists endpoints | **M** | `routes/index.js:198-211` has only geocode/places internals. | `GET /v1/reference/creator-niches`, `/languages`, `/brand-categories`, `/states`, `/states/:id/cities` (authenticated, any role; cached). | — |
| Privacy | Only status/aims/modes/coarse code; never thresholds, lists, block | **C** | See A5 and A7 evidence. | All new responses built from a single `publicSummaryOf(settings, viewerRelation)` helper; blocked ⇒ identical payload to paused. Automated test asserts no threshold keys appear. | — |

### 1.3 Also report (§2.3)

**Open-pitches count (B6).** `influencer_proposals.status` is unconstrained text (025:55-56 lists `sent | viewed | accepted | rejected | countered | expired | withdrawn`). Code writes `viewed` (`proposal.service.js:326-330`), `countered`, `rejected`, `withdrawn`; `expired` is never written (audit: TTL 7 d, no sweeper). "Active" for rate limits = `sent, viewed, countered` (:129-131; index 025:73-74). The **brand's-turn** definition already used by Needs You is `status IN ('sent','viewed') OR (status='countered' AND counter_by='creator')` (`collabCounts.service.js:52-53`). **Proposal:** "open pitches" on B6 = that brand's-turn set, ignoring `expires_at` because nothing enforces it today. (Founder note: the 30-day reply rule of §25 is not built — out of scope here, but the banner copy "You still have 30 days" describes a rule the system does not yet enforce.)

**Screens B1 / C1 / X1 / X4 attach to:**

| Mockup | Host screen | Exists? | Evidence |
|---|---|---|---|
| B1 Brand Profile row | `Packages/Mobile/src/screens/brand/BrandProfileScreen.js` | **Exists**, but it is a long inline form (business info, main branch, additional branches, links, logout — :13-18, :221-395), not the row-list of mockup B1. | Add a "Pitch settings" row + chip near the Other links block (:374-390). A full row-list restyle of the profile is item 3, not this item (Q13). |
| C1 Creator My Profile row | `Packages/Mobile/src/screens/influencer/ProfileScreen.js` | **Exists** (sections: Profile Info :341, Content Preferences :391, **Payment & Tax :461-533**, App Settings :535, Account :552, Legal :583, Logout :597). | Add "Invitation settings" row. **Payout and tax live in Profile today**; there is no Wallet screen any more (profile-only cut), so they cannot move in this item (Q12). |
| X1/X2/X3 Brand overview (creator app) | `screens/influencer/BrandProfileScreen.js` | **Deleted 2026-09-10** (`git show 5e04e1c --stat`); the old one read `/brands/:id/public` (`api.js:427`). | **Create** a minimal `BrandOverviewScreen` (header: logo, name, category · city; "Accepts pitches for" card; Pitch button; ⋯ → Block) reusable in item 3. |
| X4 Creator profile (brand app) | `screens/brand/BrandInfluencerProfileScreen.js` | **Deleted 2026-09-10**; the old one read `/influencers/:id` and had an invite modal (`git show 5e04e1c^:…:38,190-195`). | **Create** a minimal `BrandCreatorProfileScreen` (header: avatar, name, followers · ER · city, niche/language tags; "Open to invitations for" card; disabled Invite button; ⋯ → Block). |
| B6 "Open pitches → Creators tab → Pitches" | — | **Does not exist** (no tab bar; `BrandNavigator.js:14-23` is a 3-screen stack). | Placeholder route `BrandPitchesPlaceholder` ("Coming with item 8"). |
| Navigation | `BrandNavigator.js`, `InfluencerNavigator.js` | Single native stacks, `headerShown:false` (:16, :39). | Register the new screens on these stacks. |

**Theme and font vs §6.**
- `Packages/Mobile/src/theme/tokens.js` exports `colors` (navy/orange, :1-30), `darkColors` (:70-96), `lightColors` (zinc ladder + `yellow #EAB308`, ~:100-160) and a `brandPalette` (`yellow #FFC107`, ~:165-175). **None** carries the §6 values (`bg #FFFFFF`, `surface #F6F6F3`, `ink #1A1A17`, `primary #FFC700`, state colours…).
- **Proposal:** add `export const settingsTokens = { … }` to `tokens.js` with exactly the §6 names (incl. `state.*`), used by every new screen; no raw hex in screens. Aligns with the mono design rule (colour only for action + status).
- **Font:** Plus Jakarta Sans Regular/Medium/SemiBold/Bold are bundled at `Packages/Mobile/src/assets/fonts/PlusJakartaSans-*.ttf`, linked via `react-native.config.js` (`assets: ['./src/assets/fonts/']`) and exposed as `fonts.sansRegular|sansMedium|sansSemiBold|sansBold` (`tokens.js:456-475`). Already in the native build → **OTA-safe**.
- **Native modules:** none needed. `Switch`, `Modal`, `ActivityIndicator` are RN core and already used (`ProfileScreen.js:5,542`; `LocationSheet.js`). There is no toast library (grep `ToastAndroid|react-native-toast` = 0) → a tiny in-app `Toast` component (RN `Animated`), OTA-safe. Fonts, sheets, pickers, skeletons: all JS.

---

## 2. Proposed migrations (additive only)

Next free number is **168** (last: `167_deferred_creators.sql`). Runner precedent: `backend/scripts/run-167.js` (`--dry` / `--apply` against `.env.prod-backup`, refuses localhost on apply). Two files so reference data can land and be reviewed independently of the settings tables.

### 168_item2_reference_lists.sql

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS ref_creator_niches (
  code   text PRIMARY KEY, label text NOT NULL,
  sort   integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS ref_languages (
  code   text PRIMARY KEY, label text NOT NULL,
  sort   integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS ref_brand_categories (
  code   text PRIMARY KEY, label text NOT NULL, sort integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ref_states (
  id     smallserial PRIMARY KEY, name text UNIQUE NOT NULL, sort integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ref_cities (
  id       serial PRIMARY KEY,
  state_id smallint NOT NULL REFERENCES ref_states(id),
  name     text NOT NULL, name_norm text NOT NULL,          -- lower/trim, for matching typed cities
  sort     integer NOT NULL DEFAULT 0,
  UNIQUE (state_id, name));
CREATE INDEX IF NOT EXISTS idx_ref_cities_norm ON ref_cities (name_norm);

-- Seeds (idempotent ON CONFLICT DO NOTHING):
--   ref_brand_categories: MEN, WOMEN, KIDS, PLUS_SIZE, WATCHES, IMITATION_JEWELLERY, FOOTWEAR, BAGS_ACCESSORIES
--   ref_languages: the 10 labels ProfileScreen.js:13 stores today (code = label)   -- Q4b
--   ref_creator_niches: founder-approved CSV (Q4)                                   -- pending
--   ref_states / ref_cities: founder-approved CSV (Q6)                              -- pending

ALTER TABLE brands      ADD COLUMN IF NOT EXISTS major_categories text[];      -- NULL = not chosen yet (Q5)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS city_id integer REFERENCES ref_cities(id);  -- optional now (Q6)
COMMIT;
```

### 169_item2_pitch_invitation_settings.sql

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS brand_pitch_settings (
  brand_id                uuid PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  accepting               boolean NOT NULL DEFAULT true,
  paused_at               timestamptz,
  accepted_aims           text[] NOT NULL DEFAULT '{conversion,engagement,hybrid}'
                          CHECK (cardinality(accepted_aims) >= 1
                             AND accepted_aims <@ ARRAY['conversion','engagement','hybrid']),
  accepted_modes          text[] NOT NULL DEFAULT '{visit,shipment}'
                          CHECK (cardinality(accepted_modes) >= 1
                             AND accepted_modes <@ ARRAY['visit','shipment']),
  niche_codes             text[],                                   -- NULL = any
  min_followers_instagram integer CHECK (min_followers_instagram >= 0),
  min_followers_youtube   integer CHECK (min_followers_youtube   >= 0),
  min_engagement_rate     numeric(4,1) CHECK (min_engagement_rate BETWEEN 0 AND 100),
  language_codes          text[],                                   -- NULL = any
  city_ids                integer[],                                -- NULL = any
  allow_past_creators     boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS creator_invitation_settings (
  influencer_id           uuid PRIMARY KEY REFERENCES influencers(id) ON DELETE CASCADE,
  open                    boolean NOT NULL DEFAULT true,
  paused_at               timestamptz,
  accepted_aims           text[] NOT NULL DEFAULT '{conversion,engagement,hybrid}'  CHECK (… same …),
  accepted_modes          text[] NOT NULL DEFAULT '{visit,shipment}'                CHECK (… same …),
  visit_city_ids          integer[] NOT NULL DEFAULT '{}',          -- ≥1 when 'visit' accepted: enforced by PUT (Q6)
  brand_category_codes    text[],                                   -- NULL = any
  min_fee_engagement      integer CHECK (min_fee_engagement >= 0),  -- whole rupees
  min_fee_hybrid          integer CHECK (min_fee_hybrid      >= 0),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS creator_min_commissions (
  influencer_id  uuid NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  aim            text NOT NULL CHECK (aim IN ('conversion','hybrid')),
  category_code  text NOT NULL,                                     -- one of the 8 codes, or 'ALL'
  pct            numeric(5,2) NOT NULL CHECK (pct >= 1 AND pct <= 100),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (influencer_id, aim, category_code));

CREATE TABLE IF NOT EXISTS collab_blocks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_type  text NOT NULL CHECK (blocker_type IN ('brand','creator')),
  blocker_id    uuid NOT NULL,          -- brands.id or influencers.id
  blocked_type  text NOT NULL CHECK (blocked_type IN ('brand','creator')),
  blocked_id    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_type <> blocked_type),
  UNIQUE (blocker_type, blocker_id, blocked_type, blocked_id));
CREATE INDEX IF NOT EXISTS idx_collab_blocks_blocked ON collab_blocks (blocked_type, blocked_id);

-- Pitch carries a mode from now on (optional until item 8 makes it mandatory — Q11).
ALTER TABLE influencer_proposals ADD COLUMN IF NOT EXISTS shoot_mode text
  CHECK (shoot_mode IS NULL OR shoot_mode IN ('visit','shipment'));
COMMIT;
```

**Not dropped, not renamed:** `brands.accepts_proposals`, `brands.proposal_filters`, `influencers.accepts_brand_requests`, `include_in_broadcasts`, `min_fee`, `min_commission_pct`, `accepted_aims`. Marked deprecated in `COMMENT ON COLUMN`.

**No backfill** (D5). Dry-run checks in `run-168-169.js`: row counts unchanged on `brands`, `influencers`, `influencer_proposals`; 8 rows in `ref_brand_categories`; 0 rows in the three settings tables and `collab_blocks`.

---

## 3. Proposed endpoints

Response envelope as today: `{success, data}` / `{success:false, error:{code, message, field?, details?}}` (`utils/response.js:18-37`; `utils/AppError.js:19-26`). Money in whole rupees (CLAUDE.md money rule). Field-level validation errors use `code:'VALIDATION_ERROR'`, `field:` = first failing field, `details.fields = [{field, code, message}]` with the **exact §4 messages**.

### 3.1 Settings

**GET `/v1/brands/me/pitch-settings`** (brand)
```json
{ "settings": {
    "accepting": true, "pausedAt": null,
    "acceptedAims": ["conversion","engagement","hybrid"], "acceptedModes": ["visit","shipment"],
    "nicheCodes": null, "minFollowersInstagram": null, "minFollowersYoutube": null,
    "minEngagementRate": null, "languageCodes": null, "cityIds": null,
    "allowPastCreators": true, "updatedAt": null, "saved": false },
  "openPitches": 2, "blockedCount": 0,
  "summary": { "labelState": "accepting", "aims": [...], "modes": [...] } }
```
**PUT `/v1/brands/me/pitch-settings`** (brand) — full object, upsert. Validation codes → messages:

| field | code | message |
|---|---|---|
| acceptedAims | `AIMS_REQUIRED` | Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead. |
| acceptedModes | `MODES_REQUIRED` | Pick at least one mode of work. |
| minFollowersInstagram / minFollowersYoutube | `WHOLE_NUMBER` | Enter a whole number. |
| minEngagementRate | `RATE_RANGE` | Enter a rate between 0 and 100. |
| nicheCodes / languageCodes / cityIds | `UNKNOWN_CODE` | (internal) value not in the reference list |

`accepting:false` on a row that was accepting sets `paused_at=now()`; `accepting:true` clears it.

**GET `/v1/influencers/me/invitation-settings`** (creator)
```json
{ "settings": {
    "open": true, "pausedAt": null,
    "acceptedAims": [...], "acceptedModes": [...],
    "visitCityIds": [1234], "visitCitiesDefaulted": true,
    "brandCategoryCodes": null,
    "minFeeEngagement": null, "minFeeHybrid": null,
    "minCommissions": [ { "aim":"conversion", "categoryCode":"ALL", "pct": 12 } ],
    "updatedAt": null, "saved": false },
  "blockedCount": 0, "summary": { "labelState":"open", "aims":[...], "modes":[...] } }
```
`minCommissions` returns **every** stored row (including rows for unselected categories and disabled Aims) so the app can restore them; the app decides what to show.

**PUT `/v1/influencers/me/invitation-settings`** — full object; `minCommissions` is upserted row-by-row (`pct:null` deletes that row). Codes:

| field | code | message |
|---|---|---|
| acceptedAims | `AIMS_REQUIRED` | Pick at least one Aim. To stop all invitations, turn off Open to invitations instead. |
| acceptedModes | `MODES_REQUIRED` | Pick at least one mode of work. |
| visitCityIds | `VISIT_CITIES_REQUIRED` | Pick at least one city, or turn off Store Visit. |
| minFeeEngagement / minFeeHybrid | `WHOLE_RUPEES` | Enter an amount in whole rupees. |
| minCommissions[i].pct | `COMMISSION_RANGE` | Commission must be between 1 and 100%. |

### 3.2 Blocks

| Method | Path | Body / Result |
|---|---|---|
| GET | `/v1/brands/me/blocked-creators` | `{ blocked: [{ influencerId, name, avatarUrl, blockedAt }] }` |
| POST | `/v1/brands/me/blocked-creators` | `{ influencerId }` → 201 `{ block }` (idempotent: 200 if already blocked) |
| DELETE | `/v1/brands/me/blocked-creators/:influencerId` | 200 `{ unblocked: true }` |
| GET | `/v1/influencers/me/blocked-brands` | `{ blocked: [{ brandId, name, logoUrl, blockedAt }] }` |
| POST | `/v1/influencers/me/blocked-brands` | `{ brandId }` |
| DELETE | `/v1/influencers/me/blocked-brands/:brandId` | |

None of these call `notification.service`. Blocking does not touch existing `influencer_proposals` or `campaign_influencers` rows (not retroactive).

### 3.3 Public summaries

- **GET `/v1/brands/:id/public`** (existing) gains, when the caller is a creator:
  `pitchSummary: { acceptingLabelState: 'accepting'|'paused', aims: [...], modes: [...], canPitch: bool, reason: 'OK'|'NOT_ACCEPTING'|'NOT_MATCHING' }`.
  Blocked ⇒ `acceptingLabelState:'paused', canPitch:false, reason:'NOT_ACCEPTING'` — byte-identical to paused. `canPitch` is evaluated with the creator's profile only (no aim/mode yet), i.e. steps 1, 3 and 4 of §3.1.
- **GET `/v1/brands/:id/proposal-criteria`** (existing) → returns only `pitchSummary` (no `proposal_filters`). `discover-brands` stops selecting `proposal_filters`.
- **GET `/v1/influencers/:id`** (existing) gains, when the caller is a brand:
  `inviteSummary: { openLabelState: 'open'|'paused', aims, modes, canInvite, reason }` — evaluated with steps 1 and 3 of §3.2 (no set yet).

### 3.4 Eligibility service — `backend/src/services/collabEligibility.service.js`

```
loadBrandPitchSettings(brandId)            -> effective settings (defaults when no row)
loadCreatorInvitationSettings(influencerId)-> effective settings (+ commission rows)
isBlocked(blockerType, blockerId, blockedType, blockedId)
canCreatorPitchBrand({ influencerId, brandId, aim, mode })
   -> { ok, reason: 'OK'|'NOT_ACCEPTING'|'NOT_MATCHING' }              // §3.1 order, first failure wins
canBrandInviteCreator({ brandId, influencerId, set, proposedTerms })
   -> { ok, reason, warnings: ['BELOW_MIN_FEE'|'BELOW_MIN_COMMISSION'] }   // §3.2
pitchSummaryFor(brandId, viewerInfluencerId)   / inviteSummaryFor(influencerId, viewerBrandId)
```
Inputs for invite: `aim = set.goal`, `mode = set.shoot_mode`, `brandCategories = brands.major_categories`, `branchCityIds` = brand's `listing_data.branches[].city` matched to `ref_cities`, `proposedTerms = { fee: agreed_fee ?? influencer_budget, commissionPct: commission_pct }`. Inputs for pitch: `aim = payload.goal`, `mode = payload.shoot_mode` (skip mode check when absent — Q11).

**Wiring (A7):**
- `proposal.controller.js:135` — keep `checkEligibility` for ban/suspend/cooldown/rate limits; delete the brand-filter block `proposal.service.js:92-141`; call `canCreatorPitchBrand` and throw `new AppError(reason, coarseMessage, 403, 'brand_id')`. Coarse messages: `NOT_ACCEPTING` → "This brand isn't accepting pitches right now."; `NOT_MATCHING` → "You don't match this brand's pitch criteria."
- `campaign.controller.js` `invite` — insert the call directly after `getSetOrThrow` (:1098) and the `influencer_id` presence check (:1136-1138), before `assertValidChannels` (:1140). Hard fail → `AppError(reason, "This creator isn't taking invitations right now." | "This creator isn't open to this set.", 403, 'influencer_id')`. On success, merge `warnings` into the existing `success(res, {...})` payload. brand-web's modal (`[id]/page.js:222-226`) shows `res.error.message` already; the creator-terms UI for warnings is item 5.

### 3.5 Reference lists

`GET /v1/reference/creator-niches | languages | brand-categories | states` and `GET /v1/reference/states/:id/cities` → `{ items: [{ code|id, label|name, … }] }`, authenticated any role, 5-minute in-process cache (same pattern as `handshakeSettings.service.js:44-46`). `states` may include `cities` inline behind `?withCities=1` for the picker's step-1 search.

---

## 4. Proposed frontend files

### 4.1 Mobile — shared (`Packages/Mobile/src/`)

| File | Add/Change | Purpose |
|---|---|---|
| `theme/tokens.js` | change | `export const settingsTokens` = §6 palette incl. `state.*`; reuse `fonts.sans*`. |
| `components/settings/Chip.js` | add | Multi-select chip: ink fill + check when selected, white + border otherwise. |
| `components/settings/Tag.js` | add | Neutral outline Aim/mode tag (never coloured). |
| `components/settings/SettingRow.js` | add | Label · value ("Any" / "N selected") · chevron. |
| `components/settings/PickerSheet.js` | add | B4: title, Clear, search, checkbox list, "Apply · N {noun}". |
| `components/settings/StateCityPicker.js` | add | C4/C4b: two-step state→city, chips, Select all, back keeps choices, "{City} · {State}" search. Shared by B2 Cities and C2 visit cities. |
| `components/settings/ConfirmSheet.js` | add | B5 / C5 / X3 / X4 confirm (title, body, info box, primary/secondary or danger). |
| `components/settings/SaveBar.js` | add | Sticky Save; grey when unchanged/errors; "Fix N thing(s) above to save"; spinner + "Saving". |
| `components/settings/Toast.js` | add | Bottom toast with optional Undo (Animated, no native dep). |
| `components/settings/SettingsSkeleton.js`, `LoadErrorState.js` | add | B8 loading / couldn't load / Try again. |
| `components/settings/MinCommissionRows.js` | add | Per-industry % rows or single "All industries" row. |
| `hooks/useUnsavedGuard.js` | add | "Discard changes?" on back (`navigation.addListener('beforeRemove')`). |
| `services/api.js` | change | `brandApi.getPitchSettings/putPitchSettings/listBlockedCreators/blockCreator/unblockCreator`, `influencerApi.getInvitationSettings/put…/listBlockedBrands/blockBrand/unblockBrand`, `referenceApi.*`. |
| `Packages/shared/api/brand.api.js`, `influencer.api.js` | change | Same additions (kept in sync per repo rule). |
| `components/brand/ProposalFiltersSheet.js` | leave | Orphaned old filter UI; not deleted in this item (out of scope), not referenced by new code. |

### 4.2 Mobile — brand app

| File | Add/Change | Mockups |
|---|---|---|
| `screens/brand/BrandProfileScreen.js` | change | B1 row "Pitch settings" + On/Paused chip + subtitle, placed with the Other links block. |
| `screens/brand/BrandPitchSettingsScreen.js` | add | B2, B3, B5, B6, B8. |
| `screens/brand/BrandBlockedCreatorsScreen.js` | add | B7. |
| `screens/brand/BrandCreatorProfileScreen.js` | add | X4 minimal header + "Open to invitations for" + disabled Invite + ⋯ Block. |
| `screens/brand/BrandPitchesPlaceholderScreen.js` | add | B6 "Open pitches" target until item 8. |
| `navigation/BrandNavigator.js` | change | Register the four screens. |

### 4.3 Mobile — creator app

| File | Add/Change | Mockups |
|---|---|---|
| `screens/influencer/ProfileScreen.js` | change | C1 row "Invitation settings" + chip. Content-preference chips read niches/languages from A8 instead of the hard-coded arrays (:13-14) so both sides use one list. Payment & Tax left in place (Q12). |
| `screens/influencer/InvitationSettingsScreen.js` | add | C2, C3, C5, C6, B8 states. |
| `screens/influencer/BlockedBrandsScreen.js` | add | C6 blocked list + empty state. |
| `screens/influencer/BrandOverviewScreen.js` | add | X1, X2, X3 minimal header + card + Pitch button (non-functional) + ⋯ Block. |
| `navigation/InfluencerNavigator.js` | change | Register the three screens. |

### 4.4 Brand website (`Packages/brand-web`)

| File | Change | Why |
|---|---|---|
| `app/dashboard/influencers/page.js:1170-1360` | **Decision Q8.** Recommended: replace the filter panel with a one-line notice "Pitch settings are managed in the INFLX Brand app" and stop calling `proposalApi.getSettings/updateSettings`. | Otherwise the web writes the old shape while the app writes the new one. |
| `app/dashboard/influencers/[id]/page.js` | none in this item (has uncommitted local edits). The server-side invite check protects it; a refusal shows as the modal's error line (:225). | Web mirror of X4 is a later item. |

### 4.5 Tests (Phase 4 shape, for sizing)

- Backend (`backend/tests/`, jest + supertest on a real DB with `truncateAll`, run serially — `jest.config.js`, `tests/helpers/{db,factories}.js`, pattern at `collab-diary.test.js:18-45`): `item2-eligibility.test.js`, `item2-settings-api.test.js`, `item2-blocks.test.js`, `item2-persistence.test.js`. Certify no new failures against the ~231 pre-existing ones.
- Mobile (`jest` + `@testing-library/react-native 12.5.3`; only three tests exist today under `src/__tests__` and `components/__tests__`): render tests per screen state, validation-message tests for the two settings screens.
- Governance: on approval the Phase 2/3 lock is recorded as `features/item2-pitch-invitation-settings/` per the repo's contract pipeline; this document is the survey it requires.

---

## 5. Questions for the founder

Written in plain language. Each has a recommendation so a "yes" is enough.

1. **Store Visit cities vs the brand's branches (rule 3.2.4).** When a set is Store Visit, should the creator be eligible only if at least one of the brand's branch cities is in her visit list? *Recommend yes.* (Caveat: branch cities are typed by hand today, so the match works only where the typed name equals a city in the new list — see Q6.)
2. **"Always allow past creators" skips only the private filters** (niches, followers, engagement, languages, cities). It never overrides Paused, Blocked, or the Aims/modes the brand accepts. *Recommend yes, as written.*
3. **"Previously signed" means a contract carrying both signatures** on any earlier collaboration between the two. A handshake that was agreed but never signed does not count. *Recommend yes.*
4. **Creator niche list.** Today's list is generic lifestyle (food, fashion, beauty, travel, fitness, tech, home décor, parenting, finance, education), while INFLX is fashion-only and the mockup shows fashion niches (Ethnic wear, Western wear, Streetwear, Budget fashion, Men's fashion, Lifestyle). Which list should creators choose from, and should existing creators be asked to re-pick? *Recommend a fashion niche list supplied by you as a CSV before Phase 2; existing choices are kept where a code matches and otherwise shown as "Not set".*
   **4b.** Languages: keep today's 10 (Hindi, English, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi)? *Recommend yes.*
5. **Brand's category.** Every brand is simply "fashion" today; none of the 8 major categories is recorded anywhere. (a) Can a brand belong to more than one of the 8? *Recommend yes, multi-select, since a store commonly sells Women and Imitation Jewellery.* (b) Where is it set? *Recommend the brand's Business details, plus an admin override later.* (c) Until a brand has chosen, how should a creator who picked categories treat it? *Recommend "does not match" (safe side); creators who picked no categories are unaffected.*
6. **State → city list.** No list exists; cities are typed free-hand in branches and creator sign-up. (a) Source: *recommend a curated Indian states + major cities CSV that you review before it is seeded* (CSV-first, as with earlier master tables). (b) Should the branch form and the creator's city switch to the picker in this item, or in item 3 (profiles)? *Recommend item 3; in item 2 the typed values are matched by name, and anything unmatched shows as "Not set" and simply fails a city filter.* (c) A creator whose typed city cannot be matched has no default visit city; she can still save with Remote only, and must pick cities to keep Store Visit on. OK?
7. **Existing accounts start fully open** (no stored settings = all defaults), ignoring the old on/off switch. Note the old switch is accidentally **off** for any brand approved after 22 Aug, so this also fixes that. *Recommend yes.*
8. **Brand website's old "who can pitch us" panel** (tier, niches, same-city, engagement, past-collabs). It writes data the new rules no longer read. *Recommend hiding it in this item with a note "managed in the Brand app"; the web mirror comes later with the rest of brand-web.*
9. **Sets with the old "no shoot" mode, or no mode yet.** The rules doc has only Store Visit and Remote; the system also has a "no shoot" value. *Recommend: "no shoot" is checked as Remote; a set with no mode skips the mode check.*
10. **Briefing an already-agreed handshake into a set** (the retired pathway can still be finished for anyone mid-way). *Recommend the hard checks are skipped for those, since the terms were agreed before the settings existed (not retroactive).*
11. **Pitches carry no Store Visit / Remote today.** *Recommend adding the field now (optional until item 8 makes it required), so the mode rule can be enforced on the server from day one.*
12. **Payout and tax details currently sit inside the creator's Profile.** The Wallet screen no longer exists (apps are profile-only), so they cannot move in this item. *Recommend leaving them where they are; item 3 moves them.*
13. **Brand overview and creator profile screens no longer exist on the phones.** *Recommend building the minimal versions described in the mockups (header, "Accepts / Open to" card, main button, ⋯ Block), designed so item 3 fills them out rather than replacing them.* The brand Profile itself stays an inline form for now, with the new row added; the row-list layout of mockup B1 is item 3.
14. **"Open pitches" count on the paused banner** = pitches waiting for the brand's reply (new, seen, or countered by the creator). Pitches never expire today, so none are excluded by age. OK?
15. **Engagement rate exists for Instagram only.** The minimum engagement filter compares the Instagram rate. *Recommend yes; a YouTube rate is not measured.*
16. **A creator whose YouTube count was never measured** counts as 0 subscribers for a YouTube minimum (she can still pass on Instagram). *Recommend yes.*
17. **The five old brand filters** (set on the website by at most 5 test brands) are **not** carried over. *Recommend yes.*

---

## 6. Out of scope, confirmed

Full pitch flow (item 8), creator picker inside a set and its "below minimum" UI (item 5), admin UI, the 30-day pitch reply rule of §25 (not built; not this item), moving payout/tax to Wallet, deleting deprecated columns or the orphaned `ProposalFiltersSheet.js`.
