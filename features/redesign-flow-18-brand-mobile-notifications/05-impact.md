# Impact Analysis — Flow 18 · brand-mobile notifications surface

> Per `feedback_impact_terse`: **chat verdict is one line — "Impact: zero functional / backend / logic / DB impact — visual + UX only, plus one additive theme/tokens.js export."** Full mechanics live here.

## Affected files (read or change)

- **mobile (changed)**:
  - `Packages/Mobile/src/screens/brand/BrandNotificationsScreen.js` — full visual rewrite, preserves all behavior
  - `Packages/Mobile/src/theme/tokens.js` — **additive only**: new `brandPalette` export appended; `colors`, `lightColors`, `darkColors`, `businessAccents`, `fonts`, `fmtRupees`, `fmtMoney`, `fmtNum` all UNTOUCHED
- **backend**: none
- **web**: none
- **shared**: none
- **read-only verify**: 24 Wave-3 follower/restaurant screens (`MealsChatScreen`, `RestaurantDetailScreen`, `FollowerWalletScreen`, etc.) consume `lightColors` — grep confirmed; additive `brandPalette` export does not touch their import surface

## Affected routes / APIs

| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | `/v1/notifications` | none — consumed as-is | mobile brand (this screen), mobile influencer, mobile follower (parallel screens), admin queue |
| POST | `/v1/notifications/mark-all-read` | none — consumed as-is | mobile brand (this screen), mobile influencer, mobile follower |

## Affected workflows (regression surface)

Existing workflows that touch the same files/routes and must stay green:
- **All 75 tests in `pnpm qa`** — no overlap (mobile screens not in main lane); expect 75/75 GREEN gate 0
- **24 Wave-3 follower/restaurant screens consuming `lightColors`** — manual verify-twice: no behavioural change since `lightColors` is unchanged
- **Mobile brand bottom-tab routing** — unchanged; this screen's `navigation.navigate(...)` calls in `routeNotification()` preserved verbatim
- **Push notification deep-link handlers** — unchanged; `data.screen` consumption logic preserved

## Migration / deploy / OTA impact

- **New migration?** No
- **Mobile JS changed → OTA required?** Yes. Bundle ships JS-only changes (no native modules touched, no `Packages/Mobile/android/**` files, no `react-native-*` package adds). `NATIVE_RUNTIME` does NOT bump
- **APK rebuild?** No
- **Backend/web only → push only?** No — mobile-only; push triggers Vercel/Render redeploys (no-op for this change since no web/backend files touched)
- **OTA × 3 ceremony** per handoff §5 + §12: `pnpm publish-ota:brand` + `:influencer` + `:follower` (3 audit registrations of the shared bundle; all 3 are needed even though no influencer/follower screens were touched — the bundle is shared and the ceremony provides 3 audit records per release)

## Risk notes

- **Irreversible/destructive aspects**: none. Pure JS/style rewrite. Phones with old bundle continue to work; phones with new bundle see the new visual. No data migration, no schema change, no auth shift.
- **Rollback path**: if a phone-side crash appears post-OTA, run `pnpm publish-ota:all` from the previous-known-good commit `0806425` to rewrite the manifest and force the cached bundle backwards.
- **Maestro Rule 5**: this release will use `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev — qa:maestro:doctor not run, first mobile flow ships with manual founder smoke-test"` on the close-out push. Loud + recorded per `feedback_qa_governance`. Maestro setup will be its own future contract.
- **Theme additivity risk**: `brandPalette` is appended at end of tokens.js. Verify-twice: nothing currently imports a symbol named `brandPalette`, so no collision possible. Future mobile-brand flows (19+) will consume it.

## Time estimate

- Mockup build + founder lock: 30 min (current session)
- Implementation (BrandNotificationsScreen + tokens.js append): 30 min
- pnpm qa baseline + classification: 5 min
- Commit + push + OTA × 3 + close-out: 15 min

Total: ~80 min for Flow 18 (smaller than typical web flow because no NEW HTML and no test author).
