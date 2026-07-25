# Expected Outputs — Home restyle

## UI
- `HomeScreen` matches `04-preview/mockups/home-restyle.html` (new column): white header,
  single Your-turn tile, IG-clean active/activity rows + wallet strip.

## Behaviour / logic
- Your-turn count = `mergeCollabs(offers, campaigns).filter(c => c.turn === 'you').length`
  (reuses tested `utils/collabStages`).
- Active glance = merged collabs with `stage in (active, tracking)`, top 3.
- Routing: tile → Collabs; active row → Collabs/CollabDetail; activity → Notifications;
  wallet → Earnings.

## Tests
- Mobile jest: module-load smoke for the restyled `HomeScreen`; the count/active logic is
  covered by the existing `collabStages` tests (mergeCollabs/whoseTurn/deriveStage).
- **Maestro (Rule-5 gate):** Home renders → tap Your-turn tile → Collabs opens.

## Non-regression
- Full mobile jest green.
- Bell → Notifications; wallet → Earnings still work.
