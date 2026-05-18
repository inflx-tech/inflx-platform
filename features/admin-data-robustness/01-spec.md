# Feature Spec — Admin pages crash on empty/odd API payload (A5b)

> Tracked finding from A5 (admin-nav-sweep v0.2.0). Status: BACKLOG
> — recorded so it is not lost. Each fix is an app-code change and
> gets its own Step-5 lock when scheduled. NOT auto-fixed.

## Problem / goal
The A5 nav sweep proved 3 admin pages throw an uncaught client error
when the backend returns a realistic empty payload (`data:[]`), i.e.
they have NO defensive fallback for "no data yet". On a real empty
DB (pre-pilot, new install) these pages would white-screen.

## Confirmed findings (from A5 QA, 2026-05-18)
| Route | File | Symptom | Likely cause |
|---|---|---|---|
| /admin/analytics | `app/admin/analytics/page.js` | uncaught error on empty data | consumes shaped data without an array/shape guard |
| /admin/marketing/leads | `app/admin/marketing/leads/page.js` | uncaught error on empty data | same class |
| /admin/marketing/funnel | `app/admin/marketing/funnel/page.js` | `setData(res.data)` then object access; no guard when `res.data` is empty/array |

(Contrast: `/admin/escrow`, `/admin/approvals`, `/admin/marketing/inbox`
had `res.data?.x || res.data || []` fallbacks and were fine once the
stub returned a realistic shape — so this is a real, isolated gap in
the 3 above, not a systemic one.)

## Scope (when scheduled)
- In scope: add defensive fallbacks to the 3 pages so an empty/odd
  payload renders the page's empty state instead of throwing.
- Out of scope: redesigning the pages; backend changes.

## Why backlog, not now
Fixing these is app code and must follow the full pipeline
(spec→workflow→mock→lock→impact→build→QA) per page. They are real
but not release-blocking for the QA-foundation work; the founder
elected (A5 v0.2.0 decision) to track them here and proceed.

## Verification when fixed
Per-page: a deep contract (like A1) with a realistic empty fixture
asserting the empty-state renders with no uncaught error.
