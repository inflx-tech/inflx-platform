# Flow 33 — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual + UX only.

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/DeliverableListScreen.js` | Full rewrite to brandPalette + fonts + StatusPill canonical | 470 → ~480 |
| `Packages/Mobile/src/screens/influencer/DeliverableScreen.js` | Full rewrite preserving image-picker + R2 upload + live stats | 676 → ~700 |
| `Packages/Mobile/src/screens/influencer/DeliverableDetailScreen.js` | Full rewrite preserving 5-step timeline + 2-confirm Alert flows + revision UI | 657 → ~680 |
| `features/redesign-flow-33-*/` | 7 contract artifacts | new |
| `design/wave2/flow-33-*/` | mockup web.html | new (5 frames + side panel) |

**Total source delta**: ~1,803 → ~1,860 LOC (≈+60; brandPalette + fonts + MCI icon imports adds slight overhead).

## APIs touched

**ZERO** — all 8 APIs (getContractWithDeliverables / getDeliverable / getUploadUrl / uploadFile / getMediaUrl / submitDeliverable / submitLive / refreshStats) preserved verbatim.

## Backend changes

**ZERO** — no controllers, routes, migrations, schema changes.

## Regression surface

- **`pnpm qa` 76 Playwright tests**: zero Mobile-touching tests (mobile is Maestro lane); expect 76/76 GREEN gate 0 first-run with dual-probe pre-warm.
- **`pnpm qa:db`** (informational DB lane): unchanged.
- **Maestro 4/4 baseline** continues to apply. Deep Flow 33 visual verification deferred per `maestro-influencer-coverage` open question. Founder physical smoke-test on installed APK (NATIVE_RUNTIME=2) covers.

## Mobile-specific risks

- **react-native-image-picker config**: `mediaType / videoQuality / selectionLimit / includeBase64 / durationLimit` must remain byte-for-byte identical
- **3-step R2 upload state machine**: `getUploadUrl → uploadFile w/ onprogress → submitDeliverable` sequence + state flags (uploading/uploadProgress/saving) preserved
- **STATUS_PRIORITY sort** on List unchanged
- **STATUS_TIMELINE 5-step** progression in Detail unchanged
- **revision_requested timeline override** preserved (`getTimelineIndex('revision_requested') === 1`)
- **2-confirm Alert** on submitContent + submitLive preserved (Cancel + Submit buttons)
- **isOverdue() check** + red-border treatment preserved
- **5 per-row CTA branches** preserved
- **Stats null-guard** with "No stats yet" empty state preserved
- **`uploadFile` helper from api.js** must remain compatible with picker output shape

## Deploy class

**Production-impacting** — mobile screens ship via OTA. Backend untouched.

- `ota:brand` v83 (no brand-screen changes; bundle shared)
- `ota:influencer` v72 (all Flow 33 screens live here)
- `ota:follower` v46 (no follower-screen changes; shared bundle)

Native rebuild: **NOT required** (NATIVE_RUNTIME=2 baked).

## Time estimate

- 7 artifacts: 30 min (done)
- 3 screen implementations: 120 min (largest bucket flow yet)
- Web QA: 5 min (dual-probe + run)
- publish-ota:all: 5 min
- Manifest fetch + close-out lock.json: 10 min
- Push close-out: 2 min

**Total**: ~3h.
