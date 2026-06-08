# Impact — follower-home-rebuild

**Verdict: visual + navigation rebuild of Home; one intentional route change (Eat →
agreed Category). No backend/data/contract change. 4-ID chain preserved.**

## Mechanics
- `HomeScreenV2` chrome rebuilt (header/greeting/search) — presentational; data
  fetch (`getHomeSections` + fallback feed) unchanged.
- `SectionRenderer` swaps card components to `components/vibe`. Same payload in,
  same navigation targets out, EXCEPT Eat/dining now → `CategoryList` (the agreed
  screen) instead of `DiningHome`. `hasEngineContent` and the controls/hero/grid
  variants are unchanged.
- **Blast radius:** `SectionRenderer` is shared by 6 screens. Phase 1's change
  upgrades the cards for all of them (consistent, desirable); each screen's bespoke
  chrome (sticky chips, hero, full list, collabs, ranking) is refined in its own
  later phase. No screen's data contract or nav target changes (besides Eat).

## Risk
- **Regression risk: low–moderate.** Web QA cannot be affected (mobile-only). The
  real risk is a visual/runtime issue on one of the 6 engine screens — mitigated by
  defensive rendering (unknown/empty → null), babel transform, founder Maestro/APK
  smoke before the OTA go, and the smart-fallback (engine error/empty → existing
  hardcoded path).
- Reversible: revert the two files + re-publish OTA.

## Deploy
- **production-impacting** (follower OTA). Surfaced for explicit go; never silent.
  `released` stays false until go + Maestro attest (or recorded override).
