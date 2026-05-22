# Expected Outputs — fix D9 conversion invite offer_type

| Step | Observable | Verified by |
|---|---|---|
| Fix (validate) | `validateSets` adds `errs.offer_type='Pick an offer type'` when a conversion/hybrid handpick influencer has no offer_type | `git diff` |
| Fix (display) | `renderInfluencerConfig` shows the error under the Offer-type grid + marks touched on tap | `git diff` |
| Block | Conversion influencer with no offer type → "Review →" blocked, error visible | screenshot / manual |
| No regression | With offer type selected → publishes, invite 201, influencer persists | `pnpm qa:e2e:conversion` GREEN |
| Main lane | 66 GREEN / C1 / gate 0 | `pnpm qa` |
| Engagement | engagement sets unaffected (offer_type still forbidden) | code review (gated behind needsOffer) |

## Hard expectations
- The fix is **client validation only** — no backend change. The
  backend rule (`campaign.controller.js:654`) is the source of truth;
  this mirrors it so the user can't hit the silent 422.
- The existing conversion E2E (which selects an offer type) stays
  GREEN — proves the happy path is unchanged.
- No-fake-green: the fix changes behaviour (blocks the bad path); the
  E2E + manual block-proof demonstrate it.
