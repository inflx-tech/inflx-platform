# Flow 27 — Impact

## Chat impact verdict
Zero backend / API / migration / DB / business-logic touch — visual + StatusPill canonical-extension only.

## Files touched (2)

| File | LOC delta (est.) | Nature |
|---|---|---|
| `Packages/Mobile/src/screens/brand/BrandContractScreen.js` | 1341 → ~1380 (+~3%) | Full StyleSheet rewrite + JSX color/font swaps + mode-picker icon swap + StatusPill component swap (replaces 2 inline status-pill implementations). Zero logic branch touched. |
| `Packages/Mobile/src/components/brand/StatusPill.js` | 104 → ~110 | Append 3 canonical map entries: `proposed`, `confirmed`, `in_progress`. |

## APIs touched
**None.** Every `brandApi.*` call signature and payload preserved verbatim (11 endpoints).

## Regression surface
- All 17 render branches: visual swap only, no JSX structure change beyond inline-pill → component-pill swap.
- StatusPill canonical map: append-only — no existing key modified. 33 existing consumers unaffected.
- `STANDARD_CLAUSES` constant: untouched (data, not styling).
- `DateTimeChipPicker`: untouched (shared with influencer; restyle deferred).
- Wallet lock math: kept literal in 2 places — both verified identical to prior implementation.

## Mobile-specific risks
1. **State-machine combinatorics (17 branches)** — mitigated by visual-only rule + branch-by-branch diff review.
2. **`isReApprove` boolean** — `pending_influencer && !influencer_signed_at`. Negation preserved verbatim.
3. **Wallet shortage math** — preserved in both button-disabled check and breakdown card; literal duplication intentional.
4. **`keyboardShouldPersistTaps="always"`** — preserved (Android keyboard fix).
5. **`custom_clauses` defensive parse** — try/catch IIFE preserved.
6. **Inline `BrandProductionPanel`** — kept inline (no extraction).

## Window A coordination
Window A has 5 backend pushes since Flow 25 close (A10/A10.5/A11/A12.1/A12.1.5). Their work touches `backend/src/controllers/campaign.controller.js`, `entitlements.service.js`, and migration 063 — orthogonal to Flow 27. No coordination risk.

## Regression / QA prediction
- `pnpm qa` baseline = 76/76 GREEN gate 0 (verified at session start after dual-probe pre-warm).
- After Flow 27: expect 76/76 GREEN — no test surface touches mobile-only contract rewrite.
- Dual-probe pre-warm mandatory before QA per `feedback_ota_publish_strategy` (updated 2026-05-26).

## Deploy posture
**Production-impacting** — touches Mobile/src; ships via OTA × 3 (brand/influencer/follower). Backend / web is no-op (push triggers Render/Vercel auto-deploy with zero functional change).

## Maestro gate (gov-check Rule 5)
Will use `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev — mobile-brand bucket FINALE ships with manual founder smoke-test; Maestro setup deferred to its own contract"` on the close-out commit flipping `release.released=true`.

## Time
- Mockup: complete (60 min).
- Contract artifacts: complete (30 min).
- Implementation: 90-120 min estimate.
- QA + ship: 25 min.
- Total: ~3.5-4 hours.

## What ships after
Mobile-brand bucket COMPLETE (16/16). Next bucket = mobile influencer (23 screens) per `feedback_redesign_app_sequence`. Plus retroactive-certify pending-cert flows (19, 21, 23, 25) per handoff §14 when MSG91 throttle clears.
