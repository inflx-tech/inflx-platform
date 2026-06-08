# Impact — follower-home-stories-listing

**Verdict: Home Stories becomes offer-independent (picks/activity-driven). Backend
rule + one section_config re-point. No app change, no schema change, no other
shelf affected.**

## Mechanics
- New `creators_listing` rule (additive — `stories` kept). Migration 090 re-points
  only `home/stories`. The mobile app already renders the creators shelf, so no OTA.
- Other screens unaffected (Category already listing-driven; its rule unchanged).

## Risk
- **Low.** Additive rule; one reversible UPDATE. Web QA unaffected (no web surface).
  Rule failure is swallowed by the engine ([] → empty shelf, never 500).
- Reversible: re-point rule back to `stories`.

## Deploy
- **production-impacting**: Render backend (rule, auto on push) + prod
  `section_config` UPDATE via `run-090` (founder go). No OTA.
