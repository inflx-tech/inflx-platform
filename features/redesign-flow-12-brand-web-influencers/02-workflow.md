# Flow 12 · workflow — happy paths preserved

Pure restyle bundle (3 routes). All happy paths brand users run today on
the influencer bundle continue to run identically. This file enumerates
them so the implementation can be checked against OLD behaviour line by line.

---

## W1 · Brand lands on /dashboard/influencers (approved account)

1. Brand navigates to `/dashboard/influencers`
2. `useEffect` fires `brandApi.getMe()` → checks `brand.user_status === 'approved'`
3. If not approved → render the gated "Account Under Review" panel with "Back to Dashboard" button (preserved verbatim)
4. If approved → auto-fire `doSearch()` once with default `{ sort: 'rank', limit: 50 }`
5. `GET /influencers/search?sort=rank&limit=50` returns `{ data: { creators }, meta: { total } }`
6. Page renders: hero KPIs, search bar, tier chip row, row-card feed
7. INK hero KPI 3 (median min rate) computed client-side over `creators[].estimated_min_rate`

## W2 · Brand types a free-text query

1. Brand types in search input, hits "Search" (or presses Enter)
2. `doSearch()` re-fires; params include `q=<value>` plus any active filters
3. Backend SQL: `(full_name ILIKE %q% OR ig_handle ILIKE %q%)`
4. Feed updates; tier chip row counts recompute

## W3 · Brand toggles a tier chip

1. Brand clicks `Macro` chip
2. State: `tier='macro'` (or empty if same chip clicked twice)
3. `doSearch()` re-fires with `tier=macro`
4. Feed re-renders

## W4 · Brand opens "More filters" drawer

1. Brand clicks `More filters ▾`
2. `advanced=true` state toggles
3. 7 additional inputs + 3 toggle checkboxes render below
4. Each input/check binds to component state but doesn't trigger search until "Search" pressed
5. Clicking `More filters ▴` collapses the drawer (state stays)

## W5 · Brand clicks a row card

1. Brand clicks anywhere on a row (except the action button)
2. `router.push(\`/dashboard/influencers/\${c.linked_influencer_id || c.row_id}?source=\${c.source}&handle=\${c.ig_handle}\`)` — same URL shape as OLD
3. Browser navigates to profile route

## W6 · Brand clicks `+ Add to Campaign` (verified creator)

1. Action button click; `e.stopPropagation()` prevents row navigation
2. `router.push('/dashboard/campaigns')` — same as OLD
3. (Real wire-up is via the campaign wizard's handpick mode; we preserve OLD behaviour)

## W7 · Brand clicks `✉ Invite to Inflx` (unclaimed scraped creator)

1. Action button click; `e.stopPropagation()`
2. `setInviteTarget(creator)` opens the InviteModal
3. Brand fills message (optional) + proposed fee (optional)
4. `POST /brands/me/creator-invitations` with body `{ ig_handle, brand_message?, proposed_fee? }`
5. On success → modal closes → toast "✓ Invitation queued — Inflx admin will reach out to the creator"
6. On error → inline error inside modal (preserved)

## W8 · Brand paginates (not currently shipped — limit=50, OLD doesn't paginate either)

Page-1 only today (limit=50 single fetch). No pagination button in the OLD UI. We preserve that. Future Flow can add pagination if total > 50.

## W9 · Brand opens a profile

1. URL `/dashboard/influencers/{id}` mounts
2. `api.get(\`/influencers/\${id}\`)` returns `{ data: { influencer } }`
3. Page renders: INK hero with all metadata, 4 stat tiles, 2-col grid (engagement bars / pricing / collab types + past brands / audience / **activity signal**)
4. The new Activity Signal card consumes 7 already-loaded fields: `posting_frequency_per_week`, `total_posts_90d`, `commercial_post_rate`, `rank_score`, `growth_potential_score`, `activity_status`, `last_calculated_at`
5. Sticky CTA bar renders at the bottom

## W10 · Brand clicks "+ Invite to Campaign" on profile

1. `setShowInvite(true)` opens the placeholder modal (preserved verbatim from OLD)
2. Modal copy: "To invite this influencer to a campaign, go to your campaign wizard and use the influencer search in handpick mode."
3. "Go to Campaigns" → `router.push('/dashboard/campaigns')`
4. **No actual mutation** — this is intentional per OLD behaviour; out-of-scope to wire up

## W11 · Brand opens /dashboard/influencers/analytics

1. URL mounts
2. `influencerApi.analytics({})` → fat aggregate JSON
3. Renders: scope filter + 4 stat tiles + 6 chart cards + rate table + 4 leaderboards + trending brands
4. Donuts use locked-palette colors (nano=muted, micro=info, mid=eng, macro=conv, mega=yellow, celebrity=danger; verification=yellow/muted)

## W12 · Brand applies scope filter on analytics

1. Brand types city/niche or picks tier
2. Clicks "Apply"
3. `influencerApi.analytics({ city, niche, tier })` re-fires
4. All 13 query blocks re-run with the scope WHERE clause; every chart updates

## W13 · Brand clicks "View all →" on a leaderboard

1. Click triggers `router.push(\`/dashboard/influencers?sort=<rank|growth|cheapest>\`)` (preserved verbatim)
2. Brand lands on list page with that sort pre-selected

---

## Mutation-preservation contract (frozen)

- `POST /brands/me/creator-invitations` body = `{ ig_handle, brand_message?, proposed_fee? }` exactly
- Profile "Invite to Campaign" modal = placeholder with redirect to `/dashboard/campaigns` (no API call)
- `brandApi.getMe()` check on list page — preserved exactly

## Query-param contract (frozen)

All 19 search params accepted by `GET /influencers/search` continue to be sent with exact same names + value formats. Analytics `?city=&niche=&tier=` continue to be sent comma-separated.

## Role + approval gates

- All 3 routes: brand authentication + approved status (`requireRole('brand','admin'), requireApproved`)
- Frontend mirrors with `brandApi.getMe()` check on list page; profile + analytics pages don't re-check (rely on layout's redirect)
