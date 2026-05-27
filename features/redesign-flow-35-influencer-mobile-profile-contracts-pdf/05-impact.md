# Flow 35 — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual + UX only.

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/ProfileScreen.js` | Full rewrite | 675 → ~700 |
| `Packages/Mobile/src/screens/influencer/InfluencerContractsScreen.js` | Full rewrite + StatusPill | 168 → ~180 |
| `Packages/Mobile/src/screens/influencer/ContractPdfScreen.js` | Full rewrite preserving WebView | 148 → ~150 |
| `features/redesign-flow-35-*/` | 7 contract artifacts | new |
| `design/wave2/flow-35-*/` | mockup (5 frames + side panel) | new |

**Total source delta**: ~991 → ~1,030 LOC (≈+39).

## APIs touched

**ZERO** — all 5 APIs preserved verbatim.

## Backend changes

**ZERO**.

## Regression surface

- `pnpm qa` 76 Playwright tests: zero Mobile-touching; expect 76/76 GREEN first-run.
- `pnpm qa:db`: unchanged.
- Maestro 4/4 baseline applies. Founder physical smoke-test covers — particularly the WebView PDF render and UPI/Bank save flow.

## Mobile-specific risks

- WebView config (androidLayerType, originWhitelist, source URL build) preserved byte-for-byte
- Google Docs Viewer wrap URL pattern preserved (`encodeURIComponent`)
- UPI XOR Bank XOR PAN validation preserved
- IFSC required if Bank preserved
- 3 inline edit modes + editSection state machine preserved
- 10 language + 10 niche chip toggles preserved
- has_payout_method / has_upi / has_bank_account / has_pan read-only states preserved
- AES-256 encryption warning copy preserved
- Logout 2-confirm Alert + clearSession + setAppRole preserved
- role param routing on ContractPdf preserved
- listMyContracts filter + search preserved

## Deploy class

**Production-impacting** — mobile screens ship via OTA.

- `ota:brand` v85 (shared bundle)
- `ota:influencer` v74 (all Flow 35 redesigns)
- `ota:follower` v48 (shared bundle)

Native rebuild: NOT required.

## Time estimate

- 7 artifacts: 25 min (done)
- 3 screen implementations: 90 min (Profile is the biggest at 675 LOC)
- Web QA + push + OTA + close-out: 25 min

**Total**: ~2.5h.
