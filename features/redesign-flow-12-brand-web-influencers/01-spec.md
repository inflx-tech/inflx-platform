# Flow 12 · brand-web influencers bundle — spec

**Slug:** `redesign-flow-12-brand-web-influencers`
**Status:** locked (mockup approved 2026-05-24)
**Wave:** wave2 redesign (palette · row-card pattern · backend-first tiles)

---

## What this flow restyles

A **3-route bundle** under `/dashboard/influencers/**`:

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/influencers` | `Packages/brand-web/app/dashboard/influencers/page.js` | 530 |
| `/dashboard/influencers/[id]` | `Packages/brand-web/app/dashboard/influencers/[id]/page.js` | 278 |
| `/dashboard/influencers/analytics` | `Packages/brand-web/app/dashboard/influencers/analytics/page.js` | 428 |

**1,236 LOC OLD** (gradient cards, 6-color tier rainbow, modal-based detail, grid-cards) → **~1,500 LOC NEW** (locked palette · ink hero · compact row-cards · activity-signal card · scoped under `.inf` wrapper).

---

## Backend audit — every visible number traces

### Endpoint 1 · `GET /influencers/search`
- Controller: `backend/src/controllers/influencer.controller.js:411-541`
- Route: `backend/src/routes/influencer.routes.js:15`
- Gate: `requireRole('brand','admin'), requireApproved`
- Query params (preserved verbatim): `q`, `sort`, `page`, `limit`, `city`, `niche`, `tier`, `languages`, `use_case`, `min_followers`, `max_followers`, `min_view_er`, `min_rate`, `max_rate`, `min_posts_per_week`, `has_brand_collabs`, `is_inflx_verified`, `is_business`, `brand_handle`
- Sort whitelist: `rank | view_er | followers | active | growth | cheapest | most_collabs`
- Returns `creators[]` from `v_searchable_creators` view with 33 fields per row + computed `is_verified`

### Endpoint 2 · `GET /influencers/:id`
- Controller: `backend/src/controllers/influencer.controller.js:559-646`
- Route: `backend/src/routes/influencer.routes.js:56`
- Gate: `requireRole('brand','admin')`
- Returns unified `influencer` object from either `influencers` (onboarded) or `creator_profiles` (scraped) — same response shape, source flag included

### Endpoint 3 · `GET /influencers/analytics`
- Controller: `backend/src/controllers/creatorAnalytics.controller.js:52-255`
- Route: `backend/src/routes/influencer.routes.js:18`
- Gate: `requireRole('brand','admin'), requireApproved`
- Query params: `city`, `niche`, `tier` (each comma-separated multi)
- Returns 13 parallel aggregate result blocks: `overview`, `tier_distribution`, `city_distribution`, `niche_distribution`, `language_distribution`, `er_distribution.buckets`, `rate_by_tier`, `top_rank`, `top_growth`, `cheapest`, `cost_efficient`, `trending_brands`, `verification_breakdown`

### Endpoint 4 · `POST /brands/me/creator-invitations`
- Controller: `invitation.controller.js`
- Route: `brand.routes.js:122`
- Body shape: `{ ig_handle, brand_message?, proposed_fee? }`
- **Preserved verbatim**

### Endpoint 5 · `GET /brands/me` (approval gate check)
- Used to gate the entire route; preserved as-is

## Verified — no phantom fields, no API contract changes

- No new endpoint
- No new query param consumed (all params already supported by backend)
- No new request body field
- No new response field referenced (everything in the mockup already shipped today)

---

## Scope (in-scope)

### List route (`/dashboard/influencers`)
- INK hero with 3 KPIs: total searchable / Inflx-verified count / median min rate (the 3rd is derived client-side from the visible page's `estimated_min_rate` because the per-search endpoint doesn't aggregate; we explicitly label as "this page" if filtered)
- Locked-palette search bar + 4 primary inline filters (City · Niche · Tier · Min ER) + collapsible "More filters" drawer (Language · Use case · Min/Max followers · Min/Max rate · Worked-with-brand handle + 3 toggle checks: has brand collabs · verified only · business acct)
- Sort dropdown (Best fit / Best ER / Most followers / Most active / Highest growth / Lowest rate / Most collabs)
- Tier filter chip row with mono counts (derived from the visible result page)
- **Compact single-line row cards** (~64px tall): avatar · @handle · ✓verify · tier pill · ⭐ rank-mini · scraped/stale tag · 1-line meta (city · niche · collab count) · mono trio (Followers · View ER · Avg Views) · mono rate range · single action button (`+ Add` for verified · `✉ Invite` for unclaimed scraped)
- Click row → navigate to `/dashboard/influencers/{id}` (preserved)
- Action button stops propagation
- Invite modal preserved (lightly restyled to locked palette)
- Pagination strip preserved
- Empty state restyled to yellow-pale gradient

### Profile route (`/dashboard/influencers/[id]`)
- INK hero: 96px avatar · Outfit H1 (full name) · @handle (yellow) · platform / location / age / gender / scrape-date meta · bio · niche+language tags · CTA stack (yellow `+ Invite to Campaign` + ghost `View on Instagram ↗`)
- 4-tile mono stat strip: Followers / Engagement Rate (color-coded) / Avg Views / Total Posts
- 2-col grid:
  - Left col: Engagement bars (Likes / Comments / Shares / Saves) · Pricing card (mono rate range + tier-avg bar) · Collaboration types chips
  - Right col: Past Brands grid (with `unique_brands_count` as header context) · Audience Insights k/v list · **NEW Activity Signal card** (6 mono cells: posts/wk · 90d posts · commercial% · rank · growth · active-status + last-refresh note)
- Sticky bottom CTA bar (re-invitation)
- Invite modal preserved

### Analytics route (`/dashboard/influencers/analytics`)
- INK hero with header H1 + sub-line
- Scope filter strip (City · Niche · Tier)
- 4 stat tiles: Total Creators / Avg Engagement / Distinct Cities / Rate Range
- Row of 2 donuts: Tier distribution (6 palette segments) + Verification (yellow vs muted)
- Row of 2 bar lists: Top cities + Top niches
- Row of 2 bar lists: ER bucket distribution + Languages
- Rate-by-tier table (mono numbers + tier dots)
- 4 leaderboards: Top by Rank / Top by Growth / Best Cost-Efficiency / Cheapest
- Trending brands bar list

### Cross-cutting
- Locked palette throughout (no `text-blue-600` / `bg-purple-50` / etc.)
- 6-color tier rainbow → palette mapping: nano=muted, micro=info, mid=eng, macro=conv, mega=yellow-text, celebrity=danger-text
- CSS scoping discipline from day 1 under `.inf` wrapper on every page
- Outfit display + Plus Jakarta body + JetBrains Mono on every number / handle / date / ID

## Out of scope

- Any backend touch (controllers, routes, migrations, services, views)
- Any change to API request body / response shape
- Any new endpoint or query param
- Wire-up of the "Send response" pattern (no backend exists today)
- Any sidebar / nav layout change (shared `layout.js` untouched)
- Restructuring `CreatorCard` / `InviteModal` components into a separate file (kept inline per Flow 9/10/11 precedent)
- Profile page invite mutation (currently a placeholder modal that links to `/dashboard/campaigns`; preserved as-is)
