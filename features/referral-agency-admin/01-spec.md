# referral-agency-admin — admin-web Agencies page (operationalizes C3a)

> Fast-follow to Contract 3a (`features/referral-agency-role/`, deployed). C3a
> shipped the agency-approval **endpoints** but no UI — agencies can currently
> only be approved via raw API. This contract adds the admin-web **Agencies**
> screen so an admin can actually onboard + oversee agencies, plus the one
> missing backend list endpoint. UI-governed (admin-web; NOT Mobile-governed).

## Problem / goal
After C3a, agencies can sign up + register, but the founder/admin has no UI to:
1. **See pending agencies** and **approve / reject** them.
2. **Browse all agencies** (directory) with their **wallet, referral earnings,
   referral code, and active-referral count**.
This contract closes that gap with a single Agencies page + a `GET /admin/agencies`
list endpoint (C3a only exposed the pending-only queue).

## Scope
- **In scope:**
  - **Backend (additive):** `GET /admin/agencies` — paginated/filterable
    (`?status=pending|approved|rejected|suspended|all`, `?search=`) list of
    agencies with: `agency_name`, contact, city/state, `user_status`,
    `wallet_balance`, `referral_earned_total`, referral `code`, and
    `active_edges` count. Reuses C3a's `PATCH /admin/agencies/:id/status` for
    approve/reject (no new mutation endpoint).
  - **admin-web:** `app/dashboard/referrals/agencies/page.js` — status filter
    chips + search, agencies table, per-row **Approve** / **Reject (reason)**
    for pending rows, wallet/earnings/code columns for approved. Nav entry
    **Agencies** under the existing REFERRALS section; `referralApi.listAgencies`
    + `updateAgencyStatus` added to `lib/api.js`.
  - QA: jest for `GET /admin/agencies` (RBAC, filter, shape, wallet/earnings,
    empty state) + approve/reject round-trip (already covered in C3a, re-assert
    via the list); admin nav-sweep/role-gate reach the new route; `pnpm qa` GREEN.
- **Explicitly out of scope:**
  - Agency **mobile** app + signup-code UI → Contract 3b (Mobile-governed).
  - Influencer "Refer & Earn" → Contract 4.
  - Agency **settlement/payout admin actions** beyond what exists — agency
    withdrawals are self-serve (C3a); an admin payout-processing queue for
    agencies (mirroring brand/influencer payout admin) is a possible later
    addition, not here.
  - Editing agency TDS exemption/override from the UI — deferred (API exists on
    the agencies row; no admin UI this contract).

## Surfaces touched
- **App(s):** admin-web (new page + nav + api client) + backend (1 GET endpoint).
- **Roles:** admin only. List read = `requireAnyAdminRole`; approve/reject =
  `requireAdminRole('reviewer')` (the existing C3a gate — reviewer+).

## Data / contracts
- No migration, no schema change — reads `agencies` (+ `users.status`),
  `referral_codes`, `referral_edges` (count). No money movement, no writes
  except the existing status PATCH.

### New endpoint
| Method | Path | Gate | Purpose |
|---|---|---|---|
| GET | `/admin/agencies` | any admin | list agencies + wallet/earnings/code/active_edges; filters `status`, `search`, paginated |

Response row shape: `{ id, agency_name, contact_person, contact_email, city,
state, user_status, wallet_balance, referral_earned_total, referral_code,
active_edges, created_at }`. Envelope `{success,data,meta:{page,limit,total}}`.

## Non-functional
- **Auth gates** as above (defense in depth: nav visible to admins; API enforces).
- **Failure modes:**
  - No agencies → `[]` + zero meta; page renders empty state, no crash.
  - Reject without reason → existing `422` from the status endpoint; surfaced
    inline.
  - Agency with no referral code yet (never hit `/agencies/me`) → `code` null;
    UI shows "—".
  - Name/contact lookups via LEFT JOINs → no 500 on missing optional rows.
