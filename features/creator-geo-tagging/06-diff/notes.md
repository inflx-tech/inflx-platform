# 06 — Before / after notes

## Database — migration 146

`backend/migrations/146_creator_state_and_search_geo.sql`
(+ runner `backend/scripts/run-146.js`, which baselines the onboarded
city count before and after so the fix is provable, not asserted)

- `creator_profiles.state text` + `idx_creator_profiles_state_lower`.
  The column did not exist anywhere on the scraped side.
- `v_searchable_creators`: `state` appended **last** on both branches.
- Onboarded branch: `u.city` → `COALESCE(u.city, i.city)`, and
  `COALESCE(u.state, i.state)` for state. `u.city` still wins when
  present, so migration 055's decision is preserved — 055's premise
  ("`influencers.city` is always NULL") was simply incomplete, because
  the admin CSV upload writes there and never touches `users.city`.

## Backend

`backend/src/controllers/influencer.controller.js`

- `parseList(req.query.state)` + a `LOWER(btrim(state))` predicate
  mirroring the city one. City's predicate also gained `btrim` for
  consistency.
- `state` added to the result SELECT.
- New `getLocations` → `GET /influencers/locations`
  (`influencer.routes.js`, same brand/admin gate as `/search`).
  Groups on `LOWER(btrim(...))` and labels with
  `MODE() WITHIN GROUP`, so `hyderabad`/`Hyderabad` collapse.

`backend/src/controllers/marketingAdmin.controller.js`

- New `normaliseGeo()` — trim, collapse whitespace, Title-Case, blank
  → `NULL`. Applied to city and state on insert and manual update, so
  new intake stops creating case-variant duplicates.
- `insertNewLead` inserts `state`.
- `updateManualFields` can write `state`.
- **Bulk intake: a duplicate handle carrying a city/state is now
  re-tagged instead of skipped**, counted as `updated` with the
  written fields returned per row. This was the gap that would have
  quietly broken the founder's whole workflow — most handles in a
  tagging list already exist from earlier scraping.

Deliberately **not** changed: `CREATOR_COLUMNS` in
`ingest.controller.js`. Keeping `state` out means a re-scrape
structurally cannot overwrite the tag.

## Brand UI

`Packages/brand-web/app/dashboard/influencers/page.js`

- Free-text City input replaced by **State → City** dropdowns. City is
  disabled until a state is picked; changing state clears city.
- `locations` loaded once per approved session; `citiesForState`
  derived.
- `state` joins the search params, the auto-search deps, `clearFilters`
  and the active-filter count.

`Packages/brand-web/lib/api.js` — `influencerApi.locations()`.

## Admin UI

`Packages/brand-web/app/admin/marketing/add/page.js`

- CSV format is now
  `type,handle,name,city,state,category,subcategory,phone,email`
  (both the parser and the two on-screen format hints). Old 8-column
  rows still parse — `_state` is undefined and goes up empty.
- Single mode gains a State field beside City, plus a line explaining
  that these are what make a creator findable by area and that the
  scrape never overwrites them.
- `reset()` now clears `stateVal` — without it the previous creator's
  state would stick and silently mis-tag the next one.
- Bulk result gains a **Re-tagged** count, or `updated` rows would read
  as failures.

## Verified against production before asking for a go

Applied inside `BEGIN … ROLLBACK` on the live database:

- migration DDL applied cleanly; view exposed `state`
- onboarded rows carrying a city: **8 → 28**
- with AP/TS tags simulated, the dropdown resolved to Andhra Pradesh
  (Nellore 16, Vijayawada 10, Guntur 1, Visakhapatnam 1) and Telangana
  (Hyderabad 6, Godavarikhani 1); `state=Telangana` → 7 creators
- afterwards, `creator_profiles.state` confirmed **absent** from
  production — nothing persisted

## Not captured as screenshots

The dropdowns are empty until states are tagged, and the tagging
result screen needs a real bulk upload, so a Playwright shot of the
live URL would show nothing meaningful. The mockup at
`04-preview/mockups/geo-tagging.html` shows the CSV, the result
counters, both dropdown states and the recovered-creator table using
the real production numbers. Recorded deliberately.

## QA

`pnpm qa` **GREEN — 79 passed, gate 0.**

## Deploy ordering

The migration MUST run before the backend deploys — `?state=` and
`/influencers/locations` both read a column that does not exist until
then. Sequence: `node backend/scripts/run-146.js` → commit → push.
