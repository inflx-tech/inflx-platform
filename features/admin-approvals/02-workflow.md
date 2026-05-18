# Workflow Definition — Admin approvals: approve a pending brand

> Step 3. Each numbered step becomes a Playwright assertion. Drives
> real user behaviour; "page rendered" is NOT success.

## Actor
Authenticated **admin** (role=admin) on brand-web.

## Preconditions (test-seeded, deterministic)
- `localStorage.inflx_user = { role:'admin', admin_role:'superadmin', phone:'+919999999999' }`
  and `inflx_token='qa-admin'` set via `addInitScript` BEFORE app JS runs
  (so the layout role gate passes, no redirect to /login).
- Stubbed responses:
  - `POST **/auth/refresh` → `{ success:true, data:{ access_token:'qa-admin' } }`
  - `GET **/admin/stats` → `{ success:true, data:{ pending_approvals:{ brands:1, influencers:0 } } }`
  - `GET **/admin/queue/brands` → one pending brand
    `{ success:true, data:{ brands:[{ id:'br_1', brand_name:'QA Diner', category:'restaurant', status:'pending', created_at:'2026-05-18' }] } }`
  - `GET **/admin/queue/influencers` → `{ success:true, data:{ influencers:[] } }`
  - `PATCH **/admin/brands/br_1/status` → `{ success:true, data:{ id:'br_1', status:'approved' } }`

## Workflow steps (user-observable)
1. Admin opens `/admin/approvals` → "Approval Queue" heading + the
   admin sidebar render (gate passed, NOT redirected to /login).
2. The Brands tab shows the pending brand row "QA Diner" with a
   `pending` badge and an "Approve" button.
3. Admin clicks **Approve** → `PATCH /admin/brands/br_1/status` is
   issued with body `{ status:'approved' }`.
4. On success → toast "Brand approved successfully" appears and the
   queue reloads.

## Success definition
SUCCESSFUL only if: (a) the page rendered the queue without
redirecting to /login, (b) the PATCH fired with `{status:'approved'}`,
and (c) the success toast "Brand approved successfully" became
visible. Anything less (e.g. redirected to /login, no PATCH, no
toast) is a FAILURE.

## Failure / edge workflows (separate test cases, same contract)
- **Auth gate:** with NO seeded admin session, opening
  `/admin/approvals` must redirect to `/login` and never call
  `/admin/queue/brands`. (This is the A2 seed; covered minimally here
  as the negative guard.)
- **API failure:** PATCH stub returns `{success:false}` → error toast
  shown, no "approved successfully" toast.
