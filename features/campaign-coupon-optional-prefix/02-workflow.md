# campaign-coupon-optional-prefix — workflow

## End state that must execute
Brand creates a conversion campaign, handpick set, leaves Coupon prefix
blank on Sub-step 2, types a custom code (e.g. SAGAR10) for the influencer
on Sub-step 5 → "Finish set → Review" passes → publish succeeds → the
campaign_influencers row carries coupon_code=SAGAR10.

## Steps
1. Wizard Step 1 (campaign basics) — unchanged.
2. Sub-step 1: goal = conversion.
3. Sub-step 2: name/window/formats; Coupon prefix labeled optional, left blank.
4. Sub-step 3–4: handpick, add influencer.
5. Sub-step 5: Coupon code field shows "required — no set prefix, so pick
   any code"; brand types any code. Leaving it blank + review → wizard
   jumps here with an inline error.
6. Review → publish. Backend invite receives coupon_code and stores it.

## Open-group guard path
Sub-step 2 with open-group mode and blank prefix → review blocks on the
prefix field with "Required for open groups — joiners get auto-generated
codes"; backend createSet independently 422s the same condition.

## Failure backstop (defense in depth)
Direct API invite for conversion/hybrid with no custom code on a
prefix-less set → 422 VALIDATION_ERROR (field coupon_code), never a NULL
coupon row.
