# Workflow Definition — A5b harden 3 admin pages

> Step 3. Per-page user-observable behaviour after the fix.

## Actor
Authenticated admin; backend returns an empty/odd payload (new
system, or partial API failure). Deterministic test: realistic-empty
stub per page.

## Workflow per page (×3)
For each of `/admin/marketing/funnel`, `/admin/marketing/leads`,
`/admin/analytics`:
1. Seeded admin opens the route; API returns an empty payload
   (`{success:true,data:[]}` and, in a second case, `{}`).
2. The page renders its **empty / “failed to load” / “no data”
   state** — the existing copy, not a redesign.
3. **No uncaught page error** is emitted (collected via
   `page.on('pageerror')`).
4. The admin shell remains visible (page did not white-screen).

## Success definition
SUCCESSFUL only if, for every one of the 3 pages, an empty/odd
payload yields its empty-state UI with **zero uncaught page errors**
and the shell intact. A thrown error / white screen = FAILURE.

## Non-regression
- When data IS present the pages behave exactly as before. The deep
  spec includes one “populated” case per page asserting normal
  render still works (guard must not suppress real data).

## Failure / edge
- A guard that hides real data (over-correction) → the populated
  case fails. Intended: the fix must be a fallback, not a mute.
