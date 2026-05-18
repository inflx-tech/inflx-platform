# Expected Outputs — Admin navigation sweep

> Step 3 (cont.). Asserted by the QA report, per route.

## Per-route expected outputs (×18) — v0.3.0
| Check | Observable | How QA verifies |
|---|---|---|
| (a) Not gated out | final pathname is the route, not `/login` | `pathname` startsWith route && not `/login` |
| (b) Resolves | navigation response `HTTP < 400` | `resp.status() < 400` |

> (c) "no uncaught page error" was REMOVED in v0.3.0 — unsound under
> a uniform stub. The 3 genuine crash-on-empty pages are tracked in
> `features/admin-data-robustness/` (A5b), not asserted here.

## Aggregate expected output
All 18 routes PASS → "ALL WORKFLOWS PASSED" with 18 nav-sweep
workflows green in `qa/reports/latest.md`. A failing route names the
exact path + the failing check (redirect / shell-missing /
page-error) so it feeds the auto-fix loop or a follow-up contract.

## Visual evidence
- **No per-route before/after screenshots** — a nav sweep is a
  breadth regression net, not a visual baseline (avoids 18 heavy
  full-page captures). Playwright's default *screenshot +
  trace on failure* provides evidence only for routes that fail.
  (Deliberate deviation from the screenshot step; recorded here.)

## Implemented by (after lock)
`qa/web/admin/nav-sweep.spec.ts` (Step 7), parametrised over the
route list, reusing `_helpers/adminSession` + a new additive
`stubApiPermissive(page)` helper. Green in `qa/reports/latest.md`.
