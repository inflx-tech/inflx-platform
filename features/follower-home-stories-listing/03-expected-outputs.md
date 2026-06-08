# Expected Outputs — follower-home-stories-listing

## Files
- `backend/src/services/sectionRules.service.js` — new `creatorsListing` rule +
  registry entry `creators_listing`.
- `backend/migrations/090_home_stories_listing.sql` — re-point home stories rule.
- `backend/scripts/run-090.js` — prod runner (mirrors run-089).

## Acceptance checks
1. Rule `creators_listing` returns active creators offer-independently; ● LIVE
   (`has_live_deal`) only when a real live offer exists.
2. Prod read-only dry-run of the rule returns ≥1 creator incl. Sagar.
3. After 090, `/follower/home` Stories shelf is non-empty.
4. `pnpm qa` GREEN (backend rule has unit/section coverage; web suite unaffected).
5. Reversible: rule revert to `stories`.

## Release classification
- **production-impacting**: Render backend (new rule) auto-deploys on push; prod
  `section_config` re-point via `run-090` (founder go). No schema change, no app
  change. Surfaced for explicit go (migration).
