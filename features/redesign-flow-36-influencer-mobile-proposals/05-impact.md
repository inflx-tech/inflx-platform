# Flow 36 — Impact

**Chat verdict (terse)**: zero functional / backend / logic / DB impact — visual + UX only.

## Files changed

| File | Change | LOC delta |
|---|---|---|
| `Packages/Mobile/src/screens/influencer/ProposalsHubScreen.js` | Full rewrite | 298 → ~310 |
| `Packages/Mobile/src/screens/influencer/SendProposalScreen.js` | Full rewrite | 245 → ~260 |
| `features/redesign-flow-36-*/` | 7 contract artifacts | new |
| `design/wave2/flow-36-*/` | mockup (3 frames + side panel) | new |

**Total source delta**: ~543 → ~570 LOC (≈+27).

## APIs touched

**ZERO** — all 6 APIs preserved verbatim.

## Backend changes

**ZERO**.

## Regression surface

- `pnpm qa`: zero mobile-touching tests; expect 76/76 GREEN.
- `pnpm qa:db`: unchanged.
- Maestro 4/4 baseline; founder physical smoke covers.

## Mobile-specific risks

- Debounced search (300ms timeout) preserved
- 2-confirm withdraw Alert preserved
- respondCounter('accept'|'decline') preserved
- Goal-conditional fee/commission inputs preserved
- 5-format deliverable counter rows + state object preserved
- portfolio_links filter preserved
- KeyboardAvoidingView preserved
- StatusPill canonical for 6 statuses; inline yellowPale 'SENT' for sent (sender-POV)

## Deploy class

**Production-impacting** — mobile-only OTA.

- `ota:brand` v86 (shared bundle)
- `ota:influencer` v75 (all Flow 36 redesigns)
- `ota:follower` v49 (shared bundle)

Native rebuild: NOT required.

## Time estimate

~2h total.
