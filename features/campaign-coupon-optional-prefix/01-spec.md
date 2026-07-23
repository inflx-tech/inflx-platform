# campaign-coupon-optional-prefix — spec

## Problem (founder-reported, 2026-07-23)
Creating a conversion campaign in the brand-web wizard blocked at review with
"Please fix 1 field before reviewing" even though every visible field was
filled. Root cause: the set-level **Coupon prefix** (Sub-step 2) was empty —
the wizard neither pointed at the field (it lives two sub-steps back) nor
gated Sub-step 2's Continue on it. The founder had filled a per-influencer
custom coupon code (Sub-step 5), which is the natural place to name codes.

## Decision (founder, in-session)
Make the set-level coupon prefix **optional for handpick sets** — the brand
names each influencer's code however they like on Sub-step 5. Keep the
prefix **mandatory for open-group sets** (joiners have no per-influencer
code field; the prefix is the only source of their auto-generated code).

Invariant preserved: every conversion/hybrid influencer must end up with a
coupon code — custom code, or auto-generated from the prefix. Never NULL.

## Scope
- `Packages/brand-web/app/dashboard/campaigns/new/page.js` (wizard)
- `backend/src/controllers/campaign.controller.js` (createSet + invite)

## Behaviour
1. Prefix blank + handpick → valid, but each influencer's "Coupon code"
   on Sub-step 5 becomes required (inline field error).
2. Prefix blank + open group → validation error on the prefix field.
3. Prefix present → format-checked (3–15 uppercase letters/digits),
   auto-generates PREFIX_NAME defaults as before.
4. Review/publish with any invalid field → wizard navigates to the set +
   sub-step containing the first offending field and names it in the error
   (replaces the generic off-screen "fix 1 field" dead end).
5. Backend: createSet 422s on missing prefix only for open-group
   conversion/hybrid; invite 422s if a conversion/hybrid invite would land
   with neither custom code nor prefix (previously inserted NULL coupon —
   an untrackable influencer).
