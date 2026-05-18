# Workflow Definition — Admin role-gate matrix

> Step 3. Each matrix row is one Playwright case. The observable
> security outcome is the final URL.

## Actor
Visitor with varying credential state.

## The matrix (route: /admin/approvals unless noted)

| ID | Cookie `inflx_token` | localStorage user | Expected outcome |
|----|----------------------|-------------------|------------------|
| M1 | absent | absent | **server** redirect → `/login`; `/admin/queue/brands` never called |
| M2 | present | `{role:'brand'}` | passes middleware, **client** redirect → `/login` |
| M3 | present | absent (no inflx_user) | client gate `!u` → `/login` |
| M4 | present | `{role:'admin'}` | **stays** on `/admin/approvals`, "Approval Queue" visible |
| M5 | absent | — (route `/dashboard`) | **server** redirect → `/login` (matcher breadth) |

## Steps per case
1. Seed the credential state for the row (cookie via
   `context.addCookies`, localStorage via `addInitScript`).
2. `page.goto(route)`.
3. Assert the final URL matches the expected outcome.
4. M1 only: assert the stubbed `/admin/queue/brands` route received
   **0** requests (server redirect happens before any page JS).

## Success definition
SUCCESSFUL only if every row lands on its expected URL: M1/M2/M3/M5
on `/login`, M4 on `/admin/approvals` with the queue heading visible.
A non-admin reaching an admin page = FAILURE.

## Notes
- M2/M3 are the *client* gate — the approvals page may briefly mount
  and fire a fetch before `router.push('/login')` resolves; we assert
  the **final URL only** (the security guarantee), not call-counts,
  for those rows (call-count there would be racy by design).
- M1 call-count assertion is sound (server redirect, no page JS).
