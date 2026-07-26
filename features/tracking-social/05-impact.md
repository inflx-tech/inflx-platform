# Impact — Tracking (social half)

## One-line verdict
**Frontend-only, mobile-influencer, OTA — zero backend/DB.** (Platform axis stays Phase-2.)

## What changes
- Adds `CollabTrackingScreen` + `aggregateSocialStats` helper.
- `collabDetailModel`: tracking-stage hero action → 'tracking'; `sectionsFor` adds a
  'tracking' (Performance) section for post-sign collabs. (Tests updated.)
- `CollabDetailScreen.go()`: 'tracking' → navigate CollabTracking.
- `InfluencerNavigator`: registers `CollabTracking` in the Collabs stack.

## Blast radius
- No API added/changed; reuses getMyCampaignDetail + getDeliverable/refreshStats.
- No native modules → **OTA only**.
- Platform analytics + post-level sales attribution explicitly deferred (Phase 2, gated).

## Risks & mitigations
- Aggregate correctness → pure `aggregateSocialStats` + unit tests.
- N per-deliverable fetches → small N (1–3); failures skipped, not fatal.

## Release classification
**Production-impacting via OTA** → surfaced for explicit founder go. Maestro skippable on
founder call (recorded).
