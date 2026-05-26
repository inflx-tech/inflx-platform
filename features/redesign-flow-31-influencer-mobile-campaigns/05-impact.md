# Flow 31 — Impact

## Chat impact verdict
Zero backend / API / migration / DB / business-logic touch — visual restyle + StatusPill canonical extension +4 + drop legacy StatusBadge. **No native rebuild required**.

## Files touched (3)

| File | LOC delta | Nature |
|---|---|---|
| `Packages/Mobile/src/components/brand/StatusPill.js` | 115 → ~125 | Append 4 canonical map entries: `published` (infoPale/info/'PUBLISHED'), `revision_requested` (yellowPale/yellowText/'REVISION'), `locked` (bg2/muted2/'LOCKED'), `released` (successPale/successText/'RELEASED'). Map total: 39 → 43. |
| `Packages/Mobile/src/screens/influencer/MyCampaignsScreen.js` | 268 → ~300 | Full restyle. brandPalette + fonts + canonical StatusPill (drops StatusBadge import) + ink-active tab pills + mono stats + footer date range. |
| `Packages/Mobile/src/screens/influencer/CampaignDetailScreen.js` | 1,176 → ~1,210 | Full restyle. brandPalette + fonts + 5 canonical StatusPill usages (drops StatusBadge import) + MCI icons throughout (Quick Actions + back chevron + completion ico) + semantic-tone contract banners + yellow-active 5-step progress + success/yellow/ink tranche dots + yellowPale+yellow-border publish CTA + convPale negotiation info box. All 22+ render branches preserved verbatim. |

## APIs touched
**None.** Every influencerApi call signature and payload preserved verbatim (3 endpoints).

## Regression surface
- StatusPill +4 entries: additive — existing 39 entries unchanged. Brand-mobile bucket + other influencer screens unaffected.
- MyCampaigns: visual swap only. 3-tab logic + useFocusEffect + retry pattern preserved.
- CampaignDetail: visual swap on 22+ branches. renderContractSection 8-state branching preserved. Render-error try/catch wrap preserved.
- All nav targets preserved (CampaignDetail → Contract / ContractPdf / DeliverableList / CampaignProducts / Earnings / Negotiation / CampaignCompletion).
- Fee fallback chain + bonus math + products_pending math preserved.

## Window A coordination
Window A's backend work is orthogonal — Flow 31 is mobile-only.

## QA prediction
- Baseline = 76/76 GREEN gate 0 (verified at Flow 30 close).
- After Flow 31: expect 76/76 GREEN — no test surface touches mobile-influencer screens or StatusPill.
- Dual-probe pre-warm mandatory.

## Deploy posture
**Production-impacting**: OTA × 3 (brand/influencer/follower). Backend/web auto-redeploy no-op.

## Maestro gate (gov-check Rule 5)
Will use `GOVERNANCE_OVERRIDE="Maestro 4/4 baseline applies; deep CampaignDetail visual verification deferred per maestro-influencer-coverage open question (admin-verify gate blocks Home); founder physical smoke-test on installed APK covers visual upgrade"` on close-out.

## Time
- Mockup: complete.
- Contract artifacts: complete.
- Implementation: ~90-120 min (StatusPill +4 + MyCampaigns full rewrite + CampaignDetail token swaps + JSX edits).
- QA + ship + close-out: ~20 min.
- Total: ~2 hours.

## What ships after
Mobile-influencer bucket 4/23 done. Next = Flow 32 (CampaignCompletion + CampaignProducts + MyStore, ~1,225 LOC).
