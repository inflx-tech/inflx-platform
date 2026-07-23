# campaign-coupon-optional-prefix — before/after

No new visual design — this is a validation/copy change inside the locked
campaign-wizard layout, founder-directed from the live screen (screenshot
shared in-session 2026-07-23 showing the "Please fix 1 field before
reviewing" dead end with every visible field filled).

## Before
- Sub-step 2 "Coupon prefix" label: "we append the influencer's first name";
  field silently mandatory, Continue did not gate on it.
- Review error: generic "Please fix 1 field before reviewing." with the
  offending field two sub-steps off-screen; nothing highlighted.
- Right-panel checklist: "⚠ Coupon prefix" + misleading "⚠ 0 need terms".
- Sub-step 5 "Coupon code": optional always; default label showed
  CODE_NAME even when no prefix existed to generate from.

## After
- Sub-step 2 label: "optional — auto-generates PREFIX_NAME codes; or set
  each code yourself on the terms step".
- Review/publish errors navigate to the offending set + sub-step and name
  the field ("… — Coupon code in Set A, highlighted below").
- Checklist row: "Coupon codes — prefix or per-influencer"; green when a
  prefix exists OR every influencer has a custom code. "0 need terms"
  replaced with "Terms set — fix the items above" when the gap is
  set-level.
- Sub-step 5 "Coupon code": becomes required with inline red error when
  the set has no prefix; placeholder suggests NAME10-style code.
