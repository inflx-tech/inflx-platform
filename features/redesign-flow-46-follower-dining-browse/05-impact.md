# Flow 46 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** Three dining screens + the
LocationHeader atom move to brandPalette; all data calls, tracking, filter/sort,
debounce, and render branches preserved verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screens.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- **LocationHeader cascade:** it is a general atom shared by the shipped F1
  HomeScreenV2 + FindScreen. Converging its `yellowDeep` caret → `yellowText`
  produces a near-invisible shift there too. Founder approved
  ("Green — incl. LocationHeader"). Brand/influencer carry the shared bundle but do
  not render these follower screens.

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Where | Preservation |
|---|---|---|
| 4-ID tracking | DiningHome/Browse `buildTrackingFromOffer(offer)` → BrandStore nav | unchanged |
| Data | `getCategoryStores('eat')`, `getCreatorsEatingNow`, debounced `search` | unchanged |
| Card mapping | `storeToCardProps` (both screens) | unchanged |
| Browse logic | client-side filter + sort + `activeFilterCount` + FilterSheet apply | unchanged |
| Search | 300ms debounce, rotating placeholder, veg toggle, brand/dish branches | unchanged |
| Nav | vibe→`initialVibe`, search→BrandStore, eating-now→BrandStore | unchanged |
| Render branches | loading/empty/hint states on all 3 | unchanged |

## Risk
- **Regression risk: minimal.** Pure palette swaps; no control-flow or prop changes.
  LocationHeader breadth (touches F1) is the only extra vector — mitigated by it being
  a 1-token caret change + babel transform + QA.
- **Rollback:** OTA version pin to follower v58 (Flow 45).

## After-evidence
Emulator after-screenshots SKIPPED per founder. Dining screens are data/login-gated;
after-evidence = the mockup + founder physical APK smoke-test on live follower v59.

## Mockup sign-off
Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — incl. LocationHeader")
BEFORE any screen code. `mockup_locked=true`.
