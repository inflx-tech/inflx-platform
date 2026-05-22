# Workflow — fix D9 conversion invite offer_type

> Step 2. Verifier: main `pnpm qa` + the conversion E2E
> (`pnpm qa:e2e:conversion`) + manual proof the wizard blocks
> without an offer type.

## Actor
Brand, in the brand-web new-campaign wizard, Step 2 (sets), with a
conversion or hybrid handpick set + an assigned influencer.

## Steps (the fix)
1. `validateSets` per-influencer block: add `offer_type` requirement
   under `needsOffer(s.goal)`.
2. `renderInfluencerConfig`: add a `field-err` under the Offer-type
   grid + `markTouched(infTouchKey('offer_type'))` on offer-type tap.
3. Verify:
   - main `pnpm qa` GREEN 66/C1/gate 0.
   - `pnpm qa:e2e:conversion` GREEN (selects an offer type → still
     publishes, invite 2xx).
   - manual / screenshot: a conversion influencer with no offer type
     shows "Pick an offer type" and Review is blocked.
4. before/after diff note in `06-diff/notes.md`.
5. Step-14 RELEASE — PRODUCTION-IMPACTING; surfaced; founder go;
   commit (gov-check Rules 1+2+3+4 all satisfied) + push → Vercel.

## Success definition
The wizard's client validation mirrors the backend's offer_type
requirement, so a conversion/hybrid handpick influencer cannot be
published without an offer type → no silent invite 422 / dropped
influencer. No regression elsewhere.

## Failure / edge
- If main qa or the E2E spec regress → revert, investigate.
- Engagement sets must remain unaffected (they forbid offer_type) —
  the check is gated behind `needsOffer` (conversion/hybrid only).
