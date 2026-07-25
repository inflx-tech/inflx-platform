# Impact — Home restyle

## One-line verdict
**Frontend-only, mobile-influencer, OTA — zero backend/DB.**

## What changes
- Rewrites `HomeScreen` presentation to the IG-clean kit + single Your-turn tile;
  reuses `utils/collabStages` for the count + active glance.
- Data load swaps `getMyCampaigns('active')` for `getOffers(null)` + `getMyCampaigns('all')`
  (merged) — same endpoints already used elsewhere.
- Routing: active glance → Collabs/CollabDetail (was HomeStack CampaignDetail).

## Blast radius
- No API added/changed; no native modules → **OTA only**.
- Only `HomeScreen.js` touched (self-contained). Notification/Home deep-link repoints
  from earlier contracts remain valid (tiles removed → the single tile → Collabs).

## Risks & mitigations
- Extra reads on Home (offers + all campaigns) — same calls the Collabs list makes;
  failures degrade gracefully (N→0, sections hide).
- Visual regression — covered by the mockup diff + device check.

## Release classification
**Production-impacting via OTA** → surfaced for explicit founder go. Maestro skippable
on founder call (recorded).
