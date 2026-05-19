# Preview (Step 4) — search verification tag

No UI here (the brand-web UI renders the badge from
`is_verified`; that UI work is separate). Reviewer note + result.

## Reviewer note (Step-5 lock)
- **PRODUCTION-IMPACTING** (migration 055 shared w/
  fix-onboarded-creator-city-search + additive controller
  field). Founder product decision 2026-05-19: intended
  behaviour + explicit tag.
- NOT a backend defect — the carve was an uncertain-intent
  hold; founder decided "show both, tag verified". The realigned
  test encodes the decided rule (no fake-green: the rule is the
  product contract, the backend implements it correctly).
- Pending/scraped stay VISIBLE; only the `is_verified` truth is
  corrected (approval-aware for onboarded).

## Step 7 — RESULT — GREEN 2026-05-19 (RELEASED)
```
fix        : migration 055 onboarded is_inflx_verified=
             (u.status='approved'), internal_verification_status
             =u.status; influencer.controller.js +is_verified
             per result; carved test realigned (both appear;
             is_verified true/false) + renamed
qa:db      : GREEN — _fix6_remeasure_qadb.log 17:20:36Z:
             '√ includes pending influencers but tags only
             admin-verified as is_verified' GREEN; all other
             influencer-search GREEN; 54/54 0-error (true count,
             not predicted 55/55); 382/382
main pnpm qa: GREEN — 66 passed, C1 STATE=GREEN, gate 0
deploy     : PRODUCTION-IMPACTING (Render) — surfaced; founder GO
carve      : backend-defect-search-includes-pending-influencers
             → resolved working-as-intended on green
followup   : deeper 4-state taxonomy + "inform scraped influencer
             on offer" workflow = recorded future feature
```
