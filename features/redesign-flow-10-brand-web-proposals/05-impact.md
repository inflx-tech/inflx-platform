# Impact — Flow 10

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX restyle only, plus surfacing 1 backend field already loaded (`influencer_niches`) and adding per-tab counts derived from the already-loaded array.**

Same 8 endpoints, same settings shape, same modal action gating, same view-mark semantics. Wave1 palette swapped for locked wave2. Table-of-rows replaced with row-cards (inbox pattern matches Flow 9 contracts).

## Files touched (1 web)

- `Packages/brand-web/app/dashboard/proposals/page.js` — rewrite (~411 → ~550 LOC estimated; growth from CSS block + niche chips + per-tab counts + row-card layout)

## Files NOT touched

- `backend/**` (field already in SELECT)
- `Packages/brand-web/lib/api.js` (all 8 calls reused)
- All other web pages
- Mobile

## NO-TOUCH (preserved exactly)

- `proposalApi.{list, get, accept, reject, counter, getSettings, updateSettings, flag}` (8 methods)
- Settings JSON shape `{ accepts_proposals, proposal_filters: { min_tier, allowed_niches[], city_match_required, min_engagement_rate, only_past_collabs } }`
- Modal action gating (`['sent', 'viewed'].includes(proposal.status)`)
- Tab keys: `['', 'sent', 'viewed', 'countered', 'accepted', 'rejected']`
- Status pill mapping (locked palette tones replace wave1 tones; semantic state preserved)
- Tier derivation thresholds (Nano <10K · Micro <100K · Macro <1M · Mega ≥1M)
- View-mark semantics (row click doesn't call get(id); only via modal-open's separate flow — unchanged from OLD)
- Brand-approval gate from layout.js

## Window A coordination

NONE. Window A doesn't touch this surface.

## Regression risk

LOW. `pnpm qa` 71/71 must hold. No Playwright spec asserts on
`/dashboard/proposals` copy/layout. No new endpoints; no field-shape
change.

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys brand-web
- NO mobile, NO OTA
- Rule 5 does not fire

## Time estimate

~2-3h focused work. Similar scope to Flow 9 (single-file inbox restyle).
