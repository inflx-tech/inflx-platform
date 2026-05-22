# Diff notes — fix D9 conversion invite offer_type

## What changed (client validation only)
`Packages/brand-web/app/dashboard/campaigns/new/page.js`:

1. **`validateSets`** — per-influencer block, under `needsOffer(s.goal)`
   (conversion/hybrid), added:
   ```js
   if (!inf.offer_type) errs.offer_type = 'Pick an offer type';
   ```
   This rolls into `step2Errors`, so "Review →" stays blocked until an
   offer type is selected for every conversion/hybrid handpick influencer.

2. **`renderInfluencerConfig`** — under the Offer-type `.ot-grid`, added
   the standard error display:
   ```jsx
   {infErr('offer_type') && <div className="field-err">{infErrs.offer_type}</div>}
   ```
   and `markTouched(infTouchKey('offer_type'))` on offer-type tap so the
   error clears/shows like the other fields.

## Before → after (the mockup)
- **Before:** offer type optional in the UI → publish → backend invite
  422 (offer_type required) → influencer silently dropped → active
  campaign, 0 influencers.
- **After:** offer type required in the UI (mirrors backend
  `campaign.controller.js:654`) → "Pick an offer type" blocks Review →
  brand selects one → invite 201 → influencer persists.
- Mockup: `04-preview/mockups/offer-type-required.html` (the blocked
  state with the red "Pick an offer type" error + disabled Review).

## What matches the mockup
The implemented error text ("Pick an offer type") + placement (under the
Offer-type grid) + the blocked Review button match the mockup.

## What diverged
Nothing — implementation matches the spec + mockup exactly.

## Things the founder should check
- A conversion/hybrid handpick influencer with no offer type now blocks
  Review with a clear error.
- Engagement sets are unaffected (offer type still forbidden there).
- The happy path (offer type selected) is unchanged — the conversion
  E2E stays green.

## Out-of-band
None. Narrowly scoped to the client validation + its error display.
D9 part (b) (publish-time hardening on ANY invite failure) is a
separate follow-up, not in this change.
