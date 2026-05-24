# 01 · Spec — Flow 10 / brand-web proposals inbox

## What this flow is

Brand-side inbox of pitches sent by influencers. Single Next.js route,
single file: `Packages/brand-web/app/dashboard/proposals/page.js`
(411 LOC today).

## Scope

**Pure visual + UX restyle.** Same 8 endpoints, same selection +
modal action flows (accept / reject / counter), same settings JSON
shape. Wave1 palette swapped for locked wave2. Table-of-rows replaced
with row-cards (inbox-style — matches Flow 9 contracts pattern).
Surfaces 1 backend field (`influencer_niches`) already in the
`listForBrand` SELECT but unused today. Adds per-tab counts.

## Layout structure

Single column max-w-6xl (inbox surface, no rail):

1. **Header** — Outfit H1 + yellow rule + mono count chip + Settings toggle
2. **Settings panel** (collapsible) — locked palette card with switch + filter chips
3. **Warning banner** when `accepts_proposals=false`
4. **Status tabs** with mono per-tab counts (NEW — derived from already-loaded array)
5. **Proposal row cards** — replaces the OLD table; surfaces niche chips
6. **Empty state** — yellow-pale gradient card
7. **Detail modal** — 3 modes: view (with action footer) / counter / reject

## Backend audit — verified-twice (zero phantom fields)

| Field | Source | Status |
|---|---|---|
| `p.*` (id, status, pitch_title, pitch_message, proposed_fee, proposed_commission_pct, proposed_deliverables, proposed_posting_window_start, proposed_posting_window_end, portfolio_links, brand_response_message, created_at, viewed_at, goal, viewer_user_id) | `influencer_proposals.*` | real ✓ |
| `influencer_name` | `users.name` (joined via `inf.user_id`) | real ✓ |
| `influencer_handle` | `influencers.instagram_handle` (joined) | real ✓ |
| `influencer_city` | `users.city` (joined) | real ✓ |
| `followers_count` / `engagement_rate` | `influencers.*` (joined) | real ✓ |
| **`influencer_niches`** (NEW use) | `influencers.niche AS influencer_niches` (joined; ALREADY loaded, unused today) | real ✓ |
| settings | `brands.accepts_proposals` + `brands.proposal_filters` JSON | real ✓ |

All verified in `backend/src/services/proposal.service.js:171-192` (the `listForBrand` SELECT) and `backend/src/controllers/proposal.controller.js:227-248`.

## Endpoints used (preserved verbatim)

- `proposalApi.list(status)` → `GET /brands/me/proposals?status=X`
- `proposalApi.get(id)` → `GET /brands/me/proposals/:id` (also marks viewed)
- `proposalApi.getSettings()` → `GET /brands/me/proposal-settings`
- `proposalApi.updateSettings(data)` → `PATCH /brands/me/proposal-settings`
- `proposalApi.accept(id)` → `POST /brands/me/proposals/:id/accept` (server creates draft contract + notifies)
- `proposalApi.reject(id, message)` → `POST /brands/me/proposals/:id/reject`
- `proposalApi.counter(id, terms, message)` → `POST /brands/me/proposals/:id/counter`
- `proposalApi.flag(id, reason)` → `POST /brands/me/proposals/:id/flag` (not currently surfaced in UI; preserved for future)

## NEW use of already-loaded backend field

The `listForBrand` SELECT (proposal.service.js:179-181) joins
`influencers.niche AS influencer_niches` into the response but the OLD
page never renders it. Surfacing it as small niche chips on each row
gives brands instant context (matches a brand's audience/category) before
opening the detail modal.

## Out of scope

- Backend changes (none — field already in SELECT)
- API shape changes (none)
- Settings JSON shape (preserved verbatim)
- Modal action flows (accept/reject/counter) (preserved verbatim)
- The `flag` endpoint (not currently surfaced; not surfacing in this flow)
