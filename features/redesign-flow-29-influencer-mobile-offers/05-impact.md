# Flow 29 — Impact

## Chat impact verdict
Zero backend / API / migration / DB / business-logic touch — visual restyle + canonical-component swap. **No native rebuild required** (Flow 28 laid the MCI font foundation).

## Files touched (2)

| File | LOC delta | Nature |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/OfferListScreen.js` | 235 → ~290 | Tab pill restyle (ink-active) + StatusBadge→StatusPill + 5 emoji empty icons → 5 MCI icons + brandPalette + fonts. |
| `Packages/Mobile/src/screens/influencer/OfferDetailScreen.js` | 1228 → ~1280 | Ink topbar + brand row visual restyle + countdown chip + successPale fee/commission highlights + success/yellow/ink tranche dots + brandPalette throughout + StatusBadge→StatusPill + back-chev MCI icon + ink primary CTA / ghost Negotiate / danger Decline. Zero logic-branch touched. |

## APIs touched
**None.** Every `influencerApi.*` call signature + payload preserved verbatim (7 endpoints).

## StatusPill canonical map
**No changes.** All 10 statuses observed in Flow 29 are already in the 39-entry map. Map stays at 39.

## Regression surface
- 25+ OfferDetail render branches: visual swap only. JSX structure unchanged except `<StatusBadge>` → `<StatusPill>` swap + dropping legacy `colors.*` for `P.*`/`fonts.*`.
- OfferList tabs + cards: visual swap; status filter strings unchanged.
- `useCountdown` hook: untouched.
- Decline reasons modal: untouched (5 buttons + alert flow).
- Negotiate form validation: untouched (positive fee, 0-100 commission).
- Negotiation flow branches: untouched (no-neg-yet → `negotiateOffer`; existing-neg → `submitNegotiationTurn`).
- Cross-tab nested navigation: route shapes preserved.

## Mobile-specific risks
1. **State explosion** — 25+ branches. Mitigation: visual-only edits + branch-by-branch diff review.
2. **`useCountdown` 1-second interval** — preserve verbatim (interval setup + cleanup).
3. **Defensive JSON parses** — `formats_json` + `offer_config_json` may be string OR object. Preserve try/catch IIFEs.
4. **Fee fallback chain** — 4-tier `||` chain. Preserve.
5. **5 offer-type sub-renders** — discount / volume / bogo / bundle / free_gift. Each has distinct render. Preserve all conditionals.
6. **Open-group flow** — `isOpenGroup` flag drives CTA copy + decline-button label + 3 state cards. Preserve.

## Window A coordination
Window A's active backend work (entitlements/quota) is orthogonal. Flow 29 is mobile-only.

## QA prediction
- Baseline: 76 passed gate 0 STATE=GREEN (latest anchor `qa/reports/2026-05-26T06-35-54-841Z`).
- After Flow 29: expect 76 passed gate 0. No QA test surface touches influencer mobile screens directly.
- Dual-probe pre-warm mandatory before QA.

## Deploy posture
**Production-impacting (OTA-only)**:
- Backend / web = no-op (push triggers Render/Vercel auto-deploy with zero functional change).
- Mobile = `pnpm publish-ota:all` ships JS bundle. NATIVE_RUNTIME stays at 2 (no native change).
- New APKs from Flow 28 will pick up the new bundle on next launch.

## Maestro gate (gov-check Rule 5)
Will use `GOVERNANCE_OVERRIDE="Maestro 4/4 GREEN on launch flows preserved; Flow 29 ships via pure OTA (no native change); founder physical smoke-test on rebuilt installed APK covers the visual upgrade"` on the close-out commit flipping `released=true`.

## Time
- Mockup: complete.
- Contract artifacts: complete (this set).
- Implementation: 90-120 min estimate (OfferList small; OfferDetail big but visual-only).
- QA + OTA ship + close-out: ~20 min.
- Total: ~2-2.5 hours.

## What ships after
Mobile-influencer bucket 2/23 done. Next = Flow 30 (Negotiation + Brand profile · 622+200 LOC, med risk).
