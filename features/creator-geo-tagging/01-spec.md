# 01 — Spec: creator-geo-tagging

Founder, in their own words:

> "i took list of IDs mostly related to vijayawada or guntur or nellore ….
> i tag them as city and state. next if i tag city or state and i upload
> all creators info from scrapping. then if any brand comes and search
> then those tagged influencers will visible. here goal is to make system
> support this."

Also: *"leave if any other state influencers present in the current DB"* —
current data is dummy; build for the workflow, not the rows.

## What already exists (do not rebuild)

The tag → upload → scrape → findable loop is **already implemented**:

- `POST /admin/marketing/leads/intake/bulk`
  (`marketingAdmin.routes.js:19`, capability `marketing`, ≤500 rows)
  accepts an admin-supplied **`city`** and inserts into
  `creator_profiles` (`marketingAdmin.controller.js:231-252`).
- Each inserted row fires `triggerScrape(... 'deep')`
  (`:212`, `:383`) → n8n A2 → back through
  `POST /v1/internal/ingest/creator-metrics`.
- The scrape **cannot clobber the tag**: ingest is a partial-update
  upsert over an explicit allow-list
  (`ingest.controller.js:294-309`), and the n8n workflow itself routes
  Claude's parsed geography to `inferred_city`, never `city`
  (`n8n/v2/A2_v2.json:218`).
- `/admin/marketing/add` already speaks a CSV paste format that
  includes `city`.

## The gaps

### G1 — `state` does not exist on the scraped side

Verified against production: `creator_profiles` has **no `state`
column**, and no `ALTER TABLE creator_profiles` in any migration ever
added one. `influencers.state` and `users.state` do exist.

So the founder can tag a city today but not a state, and brands cannot
search by state at all.

### G2 — brand search cannot filter by state

`v_searchable_creators` exposes `city` only. `search` has no `state`
predicate.

### G3 — the search box is free text

Brands type a city by hand. Production already carries both
`'hyderabad'` and `'Hyderabad'`, so spelling decides whether a search
finds anyone.

### G4 — re-uploading a tagged list silently does nothing

Bulk intake **skips** any handle it already knows
(`marketingAdmin.controller.js:376`). The founder's workflow is
*"take a list of IDs and tag them"* — most of those handles are
already in the table from an earlier scrape, so their tags would be
dropped and they would stay unfindable. This is the gap that would
have quietly broken the whole plan.

### G5 (adjacent) — onboarded creators lose their city

Migration 055 set the onboarded branch to `u.city` on the premise that
`influencers.city` is always NULL. That premise is now incomplete: the
admin CSV upload (`admin.controller.js:600-731`) writes
`influencers.city` **and** `influencers.state` and never touches
`users.city`.

Measured on production:

| | count |
|---|---|
| onboarded creators | 29 |
| `users.city` populated | 8 |
| `influencers.city` populated | 28 |
| **have `i.city` but not `u.city`** | **20** |

Those 20 are invisible to brand city search today.

## Fix

- **Migration 146** — `creator_profiles.state` (+ `LOWER(state)`
  index); `state` appended to both branches of
  `v_searchable_creators`; onboarded `city` becomes
  `COALESCE(u.city, i.city)` and state `COALESCE(u.state, i.state)`.
  `u.city` still wins when present, so 055's decision is preserved.
- **Search** — `?state=` filter, case- and whitespace-insensitive,
  matching the existing city predicate.
- **`GET /influencers/locations`** — distinct tagged states, each with
  its cities and creator counts, grouped case-insensitively.
- **State → City dropdowns** on Discover, built from that endpoint.
- **`normaliseGeo()`** — Title-Case + collapse whitespace on write, so
  new intake stops creating `hyderabad`/`Hyderabad` pairs.
- **Bulk re-tagging** — a duplicate handle carrying a city or state now
  has those manual fields updated and is reported as `updated`, not
  skipped. Scraped metrics are untouched.

## Deliberate decisions

- **`state` is NOT added to `CREATOR_COLUMNS`** in
  `ingest.controller.js`. `city` sits in that allow-list and is
  protected only by n8n convention; keeping `state` out makes it
  *structurally* impossible for a re-scrape to overwrite the founder's
  tag. The tag is the whole feature — convention is not enough.
- **Dropdowns are data-driven, not a reference table.** The admin tags
  state at intake, so the dropdown should show exactly what has been
  tagged. A lookup table would drift and would need a row added before
  a newly-tagged city could be selected.
- **Creators with no state are omitted** from the location lists and
  from any state/city search — the founder's choice ("hide them").
  They remain findable by tier, niche, followers and name.
- **No state whitelist.** The founder is Telugu-states-first, but
  hard-coding that would strand creators elsewhere and need a code
  change to expand. The dropdown is ordered by creator count, so the
  states they actually tag rise to the top on their own.

## Out of scope

- File upload (`.csv`/`.xlsx`) for creator leads — intake is textarea
  paste today. Noted, not built.
- A general edit-creator screen. Changing a tag still means
  re-submitting the handle.
- Backfilling states onto existing dummy rows.
