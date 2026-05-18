# Expected Outputs — A5b harden 3 admin pages

> Step 3 (cont.). Asserted by the QA report. Defined BEFORE code.

## Per-page expected outputs (empty payload)
| Page | Empty-state observable | No-crash check |
|---|---|---|
| marketing/funnel | existing "Failed to load funnel." (or a defined empty state) visible | `pageerror` collector empty |
| marketing/leads | existing empty leads indicator visible (no rows / "no leads") | `pageerror` collector empty |
| analytics | existing "No data" / empty analytics state visible | `pageerror` collector empty |

(Exact empty-state strings are confirmed against the POST-FIX render
at Step 7 and pinned in the spec — behaviour is fixed here; the
selector is an implementation detail.)

## Per-page expected outputs (populated payload — non-regression)
| Page | Observable |
|---|---|
| each ×3 | with a realistic populated stub, the page renders its normal content (a known element/value visible) — proves the guard is a fallback, not a data mute |

## Data assertions
- Zero uncaught `pageerror` on every empty-payload case (×3, ×2
  shapes = `[]` and `{}`).
- Populated case still renders real content (×3).

## Visual evidence
- after: `screenshots/after/a5b__<page>-empty.png` ×3
  (each page's empty state, no white screen)

## Implemented by (after lock)
- App fix: minimal guards in the 3 `page.js` files.
- Verify: `qa/web/admin/data-robustness.spec.ts` (3 pages ×
  empty+populated). Green in `qa/reports/latest.md`. On green, A5
  v0.3.0's deferred findings are closed (note back-reference in
  admin-nav-sweep lock).
