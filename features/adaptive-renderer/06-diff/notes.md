# Before / After — Adaptive Renderer (Phase 4)

## 4a (shipped) — engine logic + preview API
Before: no renderer. After: `renderSpec.service` + `experience-preview` API, live
(commit b9561ad). Proven by `render-spec.spec.ts` (4/4) + local buildPreviewSpec.

## 4b (built, off-device verified; Maestro on-device pending)
**Before:** `04-preview/mockups/adaptive-renderer.html` — one theme drawn into
Hero / Story / Tile / Magazine.
**After (built):** RN `AdaptiveRenderer` + `ExperiencePreviewScreen` (dev entry
on Profile, flag `EXPERIENCE_PREVIEW_DEV`). Proven off-device by
`AdaptiveRenderer.test.js` (5/5, @testing-library/react-native):
- Hero shows title + subtitle + CTA + offer (all in contract).
- Story drops subtitle + CTA (hidden), keeps title + offer.
- Tile keeps featured + title + avatar; drops offer.
- Magazine (card) credits the creator.
- Blocked spec → missing-slot placeholder, no crash.
Full mobile jest: 30/30 tests pass (the 1 flagged suite, CartScreen, is a
pre-existing parallel-run act() warning — passes in isolation, imports none of
the changed files).

## On-device (Maestro) — the mobile-governed gate, pending
Flow `qa/maestro/flows/06-experience-preview.yaml` asserts the contract ON DEVICE:
Hero shows "Explore collection"; switching to Story hides it while the title
stays. Runs on the founder's emulator (`pnpm qa:maestro`); screenshots
`experience-preview-hero` / `-story`. `release.released` flips true only after
Maestro is green + founder go + OTA.

## Not user-facing
The preview screen is a flag-gated dev surface reached from Profile. It does not
change the live follower experience; the existing `SectionRenderer` / home are
untouched. Real experiences render via this component in Phase 5-6.
