# Diff notes — referral-agency-admin

## What was implemented
A new admin-web **Agencies** page at `/dashboard/referrals/agencies` (built
static; route compiled), backed by a new read-only `GET /admin/agencies`
endpoint (`admin.controller.getAgencies` + route, any-admin gate) that returns
agencies with status, wallet, referral earnings, referral code, and
active-referral count. Approve/Reject reuse C3a's existing
`PATCH /admin/agencies/:id/status`. Nav entry **Agencies** added under the
REFERRALS section; `referralApi.listAgencies` + `updateAgencyStatus` added to
`lib/api.js`. No migration, no schema change, no money movement.

## What matches the locked mockup
- `01-agencies.html` — matches: "🏛️ Partner Agencies" header + subcopy; status
  filter chips (Pending / All / Approved / Rejected) + name search; the agencies
  table (Agency w/ contact sub-line, City, Status badge, Code, Wallet, Earned,
  Active refs, Joined); per-row **Approve** / **Reject** for pending rows;
  approved rows show code + wallet + earned + active-refs; reviewer-gated
  actions; empty-state placeholder; the role note.

## What diverged from the mockup (and why)
- **Reject uses a prompt() for the reason** rather than an inline reason field /
  modal. Lightweight + adequate for an internal reviewer tool; the API contract
  (`PATCH … {status:'rejected', reason}`) is unchanged, and an empty reason is
  blocked client-side + server-side (422). Flagged, not silent.
- **Default filter is "Pending"** (mockup highlighted "All"); Pending-first is
  the more useful landing state for the approval workflow. Cosmetic.
- Pending rows show "—" for wallet/earned/code/active-refs (no data yet),
  exactly as the mockup depicted.

## Things the founder should specifically check
- **Empty state** (likely prod state today — no agencies signed up yet): page
  shows the 🏛️ placeholder, not a crash.
- **Role behaviour:** a finance admin can view but sees no Approve/Reject; a
  reviewer/superadmin can act. The API enforces it regardless of the button.
- **Approve flow:** approving a pending agency moves it to the Approved filter
  and unlocks its withdrawal (C3a); the wallet/earned/code/active-refs columns
  then populate from live data.

## Out-of-band changes
- None. Shared-file edits (`layout.js`, `lib/api.js`, `admin.controller.js`,
  `admin.routes.js`) are additive, staged by explicit path. No adjacent fixes.

## After-shots
- "Before" = the locked mockup `04-preview/mockups/01-agencies.html`.
- "After" = the real `/dashboard/referrals/agencies` route on the deployed
  Vercel admin-web (requires an authenticated admin session; captured from the
  running app post-release rather than a static render).
