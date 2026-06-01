# Expected Outputs — referral-agency-admin

> Defined BEFORE coding. QA asserts against these.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | `GET /admin/agencies?status=pending` → rows w/ `{id,agency_name,contact_person,city,user_status:'pending',created_at}`, `meta.total` | jest: seed pending agency, GET, assert shape |
| 2 | Approve → agency `user_status='approved'`; subsequent `?status=approved` includes it, `?status=pending` excludes it | jest: PATCH approve, re-GET both filters |
| 3 | Reject (reason) → `user_status='rejected'`; reject w/o reason → 422 | jest: PATCH reject paths |
| 4 | `?status=approved` rows carry `wallet_balance`, `referral_earned_total`, `referral_code`, `active_edges` | jest: seed agency w/ code + edge + wallet, assert values |
| 5 | `?search=Vizag` returns matching agency only | jest: search filter |
| RBAC | non-admin → 401/403; reviewer can approve; list open to any admin | jest: role matrix |
| empty | no agencies → `{data:[],meta:{total:0}}` | jest: empty assert |

## Data assertions
- `GET /admin/agencies` performs **no writes** (read-only); approve/reject go
  through the existing C3a `PATCH` (no new mutation path).
- `wallet_balance` / `referral_earned_total` equal the `agencies` row values
  exactly; `active_edges` = count of `referral_edges` where
  `referrer_type='agency' AND referrer_id=agency.id AND status='active'`.
- `referral_code` = the agency's `referral_codes.code` or null.

## Web (admin-web) expected outputs
- Nav shows **Agencies** under the REFERRALS section.
- `/dashboard/referrals/agencies` resolves for an admin (nav-sweep GREEN),
  redirects to `/login` without a session (role-gate GREEN).
- Pending rows show Approve / Reject; approved rows show wallet/earnings/code;
  empty state renders, no crash.

## Visual evidence required (UI-governed)
- `04-preview/` mockup(s) of the Agencies page (pending + approved states +
  reject flow + empty), mockup-locked before implementation.
- `06-diff/notes.md` before (mockup) / after (real route) signed off before
  deploy.
- `pnpm qa` GREEN (new route reachable; existing admin/web/API unregressed).
