# Feature Spec — Harden 3 admin pages against empty/odd API payload (A5b)

> Promoted from backlog to ACTIVE 2026-05-18 (founder picked A5b as
> next). First app-code change via the contract pipeline.
> Implementation GATED on `lock.json.approved = true`.

## Problem / goal
A5 proved 3 admin pages throw an uncaught client error when the
backend returns a payload that is truthy but not the expected shape
(e.g. `[]` / `{}` / missing keys). On a fresh/empty system (pre-pilot,
new install, or a partial API failure) these pages white-screen
instead of showing their empty/failed state.

## Confirmed crash points (verified in code, 2026-05-18)
| Route | File | Exact bug |
|---|---|---|
| /admin/marketing/funnel | `app/admin/marketing/funnel/page.js` | Guards `!data` only. A truthy non-shaped `data` reaches `data.influencers.counts` / `data.brands` / `data.totals` → TypeError. |
| /admin/marketing/leads | `app/admin/marketing/leads/page.js` | `setOpts(r.data)` overwrites the well-shaped default `{cities:[],niches:[],…}`; a non-object payload makes `opts.<key>.map` throw. |
| /admin/analytics | `app/admin/analytics/page.js` | `setData(res.data)`; render does nested access on `data` when it's truthy-but-non-shaped (passes the `!data` guard). |

Bug class is uniform: **a truthy-but-wrong-shape payload is treated
as valid; the page must instead fall back to its empty/failed state.**

## Scope
- In scope: minimal defensive guards on these 3 pages so an empty/odd
  payload renders the page's existing empty/failed UI with **no
  uncaught error**. Smallest change that fixes the class — no
  redesign, no refactor, no new abstractions.
- Out of scope: backend changes; other pages; styling; behaviour when
  data IS present (unchanged).

## Surfaces touched
- 3 files under `Packages/brand-web/app/admin/**` (web). Brand-web
  only — no migration, no mobile, no OTA.

## Non-functional
- Verified by a NEW deep spec `qa/web/admin/data-robustness.spec.ts`
  (per-page, realistic-empty stub) — sound because per-page, unlike
  the uniform nav sweep.
