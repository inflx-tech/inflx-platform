# Workflow Definition — Referral Intake (D-1/D-2/D-3)

## Actor
New brand/influencer (signup), existing influencer (apply), admin (accept/allocate).

## Preconditions
Migration 108 applied; the referral engine present.

## Workflow steps (user-observable)
1. A brand registers on the web and enters an optional "Referral code (if any)" → on success the
   brand is linked to the referrer (a signup edge is created). A bad code does NOT block signup.
2. (Backend ready, mobile follow-up) An influencer enters a code at signup → linked the same way.
3. An influencer applies to become a referrer (POST /referrals/apply) → a "requested" application
   is created. (In-app button is the mobile follow-up; endpoint live now.)
4. Admin → Referrals → Applications: sees pending requests → Approve (a code is generated &
   allocated to the applicant, shown) or Reject.
5. Admin can Generate a code for any influencer/agency directly (D-3).

## Success definition
- A code entered at signup creates the referrer→referred edge (income then accrues via the
  existing engine). Influencers can apply; admins accept and allocate codes.

## Failure / edge workflows
- Invalid/duplicate/empty code at signup → registration still succeeds; a soft note only.
- Duplicate pending application → 409 (partial-unique index), not a 500.
- Non-superadmin cannot decide applications or generate codes.
