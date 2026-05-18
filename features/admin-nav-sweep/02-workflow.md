# Workflow Definition — Admin navigation sweep

> Step 3. One parametrised case per route (18). Real navigation as an
> authenticated admin.

## Actor
Authenticated admin (seeded via `_helpers/adminSession`:
cookie + localStorage role=admin).

## Preconditions
- Permissive API stub: every request to `**/v1/**` →
  `{ success:true, data:[], meta:{} }` (realistic empty; v0.2.0 —
  see 01-spec revision note. `data:[]` lets the pages' fallback
  chains resolve to an empty array instead of a non-array object).
- A `pageerror` listener attached per case to collect uncaught
  exceptions.

## Workflow (repeated for each of the 18 routes) — v0.3.0
1. `page.goto(<route>)` as the seeded admin (perm. stub installed).
2. Final URL is the target admin route, NOT `/login`.
3. The navigation response status is `< 400`.

## "Reachable" success definition (both required) — v0.3.0
A route PASSES only if: (a) final URL is the requested admin route
(not `/login`) — proves the gate let an admin in, AND (b) the
server resolved it (`HTTP < 400`) — proves no NAV→404 drift.

Client-side crash-on-empty is **out of this net's scope** (cannot be
sound under a uniform stub) and is tracked separately in A5b — see
the v0.3.0 revision note in 01-spec. This is a deliberate scoping of
what a breadth net can soundly assert, not suppression: the genuine
findings are recorded in their own contract.

## Failure / edge
- A redirect to `/login` for a seeded admin → gate regression.
- An uncaught error / Next error overlay → page regression.
- A 404 (route removed but still in NAV) → NAV/route drift.
All three are real defects the sweep exists to catch — reported
per-route in the QA report, not globally hidden.
