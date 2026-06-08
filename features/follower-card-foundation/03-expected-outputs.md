# Expected Outputs — follower-card-foundation

> Step 4. Concrete, checkable end states.

## Files produced (all NEW; no existing file edited)
- `Packages/Mobile/src/components/vibe/Gradient.js`
- `Packages/Mobile/src/components/vibe/ShelfHeader.js`
- `Packages/Mobile/src/components/vibe/StoryCircle.js` (exports `StoryCircle` + `StoryRail`)
- `Packages/Mobile/src/components/vibe/CategoryCircle.js` (exports `CategoryCircle` + `CategoryRail`)
- `Packages/Mobile/src/components/vibe/FeatureCard.js`
- `Packages/Mobile/src/components/vibe/DealCard.js`
- `Packages/Mobile/src/components/vibe/ShelfProductCard.js`
- `Packages/Mobile/src/components/vibe/ShelfBrandCard.js`
- `Packages/Mobile/src/components/vibe/ViaCreatorChip.js`
- `Packages/Mobile/src/components/vibe/RankBadge.js`
- `Packages/Mobile/src/components/vibe/index.js`
- `features/follower-card-foundation/04-preview/mockups/component-gallery.html`
- `features/follower-card-foundation/04-preview/workflow-prediction.md`
- `features/follower-card-foundation/06-diff/notes.md`

## Acceptance checks
1. **Inert** — `grep` shows NO screen/`SectionRenderer` imports from
   `components/vibe` (it ships nothing until Phase 1). `git status` touches only
   new files under `components/vibe/` + this contract folder.
2. **OTA-safe** — no new dependency in `Packages/Mobile/package.json`; no import of
   `react-native-linear-gradient` / `react-native-svg` / `expo-*`.
3. **Backend-first** — `ShelfBrandCard` references no `rating`/`distance` field.
4. **Defensive** — each component returns `null` (no throw) on missing/empty props.
5. **QA** — `pnpm qa` GREEN (web 79/79 + C1; mobile-only change cannot regress web);
   every new file babel-transforms via the Mobile metro preset.
6. **Diff** — `06-diff/notes.md` non-empty: component-gallery vs comprehensive
   mockups, with the gradient + omitted-rating fidelity notes called out honestly.

## Release classification
- **deploy-inert.** New, unimported component files. `git push` changes nothing in
  production (no screen renders them; no OTA needed). `released` stays **false**;
  the OTA happens with Phase 1 (Home), which is where these first become visible.
- gov-check expectation: Rule 1 (approved contract) + Rule 3 (mockup_locked) +
  Rule 4 (`06-diff/notes.md` present) satisfied for the `components/` path touch.
  Rule 5 (Maestro) not triggered — `released` stays false.
