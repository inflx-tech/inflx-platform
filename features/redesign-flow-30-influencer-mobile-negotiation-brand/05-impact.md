# Flow 30 — Impact

## Chat impact verdict
Zero backend / API / migration / DB / business-logic touch — visual restyle + StatusPill role-perspective extension + canonical-component cleanup. **No native rebuild required**.

## Files touched (3)

| File | LOC delta | Nature |
|---|---|---|
| `Packages/Mobile/src/components/brand/StatusPill.js` | 110 → ~115 | Append `mode='influencer'` branch that overrides `awaiting_brand` + `awaiting_influencer` labels. ~3-line addition mirroring existing `mode='transaction'` pattern from Flow 21. Existing 39-entry canonical map UNCHANGED. |
| `Packages/Mobile/src/screens/influencer/NegotiationScreen.js` | 622 → ~640 | brandPalette + fonts + chevron-right MCI in offer-progress arrow + hourglass MCI in waiting banner + ink/yellow Accept + ink/yellow Counter + dangerPale Walk Away + bg2/yellowPale L/R turn bubbles + canonical StatusPill in header. Drops dead `import StatusBadge` + drops `colors.orange`/`colors.orangePale` turn-actor badge. All 13 render branches + goal-aware logic + 3 action paths preserved verbatim. |
| `Packages/Mobile/src/screens/influencer/BrandProfileScreen.js` | 200 → ~210 | brandPalette + fonts + 68×68 yellow logo tile (ink Outfit-Black initial fallback) + ink topbar w/ yellow rule + back-chevron MCI + yellowPale stat box w/ ink mono number. All 6 render branches preserved. |

## APIs touched
**None.** Every influencerApi call signature and payload preserved verbatim (4 endpoints).

## Regression surface

- StatusPill `mode='influencer'` extension is additive — existing consumers (brand-mobile bucket + influencer screens that don't pass mode) continue to see today's labels.
- Both screens: visual swap only. No JSX structure change beyond StatusBadge import removal (NegotiationScreen) and canonical pill substitution in NegotiationScreen header.
- L/R turn-bubble alignment based on `turn.sent_by === 'influencer'` — preserved exact conditional.
- Goal-aware logic + counter validation + Alert.alert flows — preserved verbatim.

## Window A coordination
Window A's backend work is orthogonal — Flow 30 is mobile-only.

## QA prediction
- Baseline = 76/76 GREEN gate 0 (verified at Flow 29 close).
- After Flow 30: expect 76/76 GREEN — no test surface touches mobile-influencer screens or StatusPill.
- Dual-probe pre-warm mandatory before QA.

## Deploy posture
**Production-impacting**: OTA × 3 (brand/influencer/follower bundles). Backend/web auto-redeploy on push as no-op.

## Maestro gate (gov-check Rule 5)
Will use `GOVERNANCE_OVERRIDE="Maestro 4/4 baseline applies; deep Negotiation/BrandProfile visual verification deferred per maestro-influencer-coverage open question (admin-verify gate blocks Home); founder physical smoke-test on installed APK covers visual upgrade"` on close-out.

## Time
- Mockup: complete.
- Contract artifacts: complete (this set).
- Implementation: ~60-90 min (StatusPill +5 lines + 2 screen restyles).
- QA + ship + close-out: ~20 min.
- Total: ~1.5-2 hours.

## What ships after
Mobile-influencer bucket 3/23 done. Next = Flow 31 (My Campaigns + Campaign Detail, ~1,444 LOC).
