# Flow 44 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** Two F3-tail screens move to
light brandPalette; lead capture, returns fetch, tracking, validation, and all
render branches preserved verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled screens.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
  Brand/influencer carry the shared bundle (no brand/influencer-screen change).

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Where | Preservation |
|---|---|---|
| Lead capture | Enquiry `submitEnquiry({brand_id, campaign_id, set_id, campaign_influencer_id, form_data})` | payload byte-for-byte |
| 4-ID tracking | Enquiry `trackingParams.cid/sid/iid` + `oid` in form_data.offer_id | unchanged (lead attribution) |
| Pre-fill | Enquiry AsyncStorage `inflx_user` → name/phone | unchanged |
| Validation | Enquiry required-field + 10-digit phone check | unchanged |
| Returns fetch | MyReturns `listMyReturns()` → `GET /follower/returns` | unchanged |
| Refund math | MyReturns `fmtRupees(r.refund_amount)` | unchanged; mono render |
| Status mapping | MyReturns `STATUS_THEME` (5 states) | keys unchanged; only colors → brandPalette pales |
| Refresh / focus | MyReturns RefreshControl + useFocusEffect reload | unchanged |
| Render branches | Enquiry form/success · MyReturns list/empty | all preserved |

## Risk
- **Regression risk: minimal.** No control-flow edits; restyle is token/StyleSheet
  only. MyReturns is a full StyleSheet rewrite (hardcoded hexes) + STATUS_THEME
  recolor — verified by post-restyle grep + babel transform + QA.
- **Rollback:** OTA version pin to follower v56 (Flow 43).

## After-evidence
Emulator after-screenshots SKIPPED per founder (AskUserQuestion 2026-05-28 — "Green
— implement", skip path). Lead/returns screens are login + data-gated. After-evidence
= founder physical APK smoke-test on live follower v57.

## Mockup sign-off
Founder green-signaled the per-flow mockup via AskUserQuestion 2026-05-28 BEFORE any
screen code. `mockup_locked=true`.
