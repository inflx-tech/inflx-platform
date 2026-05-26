# Impact — billing-feature-discover-filter (A12.2)

## Changes
- 1 service helper added (`entitlements.service.configFor`).
- 1 controller helper + 2 endpoints wired (`campaign.controller`).
- 1 migration (`M063`) flips is_enforced=true.
- 1 runner script.
- 1 contract folder.

## Blast radius
- `searchInfluencers` + `openGroupMatches` change behaviour for brands on tiers with area_scope != 'all_india'. Free/Growth brands see narrower influencer pool after deploy + M063 prod run.
- Response envelopes additive (new `discover_filter` field). Existing consumers ignore unknown fields.
- `_applyDiscoverFilter` defensive: fails open on missing city/state/config — no brand workflow breaks.
- No effect on other campaign controller functions, no effect on other features.

## Rollback
Revert the commit + revert M063 (`UPDATE features SET is_enforced=false WHERE feature_key='discover_filter'`). All searches return to unfiltered behaviour immediately.

## Risks
- **Brand sees fewer influencers than before** — by design, but if admin's tier config is wrong, brand may see zero. Mitigation: admin can immediately edit tier config in Section C; entitlements cache TTL = 60s.
- **Influencers with NULL state get excluded from state-scope filter** — pre-existing data quality issue surfaces. Acceptable; admin can flag for ops backfill if it bites.
- **No frontend UX hint yet** — brand on Free seeing only city influencers has no banner explaining why. The response includes `discover_filter.area_scope` so a future frontend tweak can show "Showing influencers in your city (Free plan — upgrade for state-wide)". Out of scope for A12.2.

## Pre-push checklist
1. pnpm qa main GREEN.
2. Backend boot smoke clean.
3. M063 applied locally + sanity probe shows is_enforced=true.
4. gov-check exit 0 (Rules 1+3+4).
5. M063 prod run gated on separate explicit founder go after push.
