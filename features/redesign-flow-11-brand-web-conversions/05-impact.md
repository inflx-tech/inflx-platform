# Flow 11 · impact

**Terse verdict (chat):** zero functional / backend / logic / DB impact —
visual + UX only. Adjacent-fix: drop dead OLD-UI status colors that the
backend never writes.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/conversions/page.js` | full rewrite against locked mockup | ~393 → ~650 |
| `design/wave2/flow-11-brand-web-conversions/web.html` | new mockup | +764 |
| `features/redesign-flow-11-brand-web-conversions/01-spec.md` | new | +200 |
| `features/redesign-flow-11-brand-web-conversions/02-workflow.md` | new | +130 |
| `features/redesign-flow-11-brand-web-conversions/03-expected-outputs.md` | new | +120 |
| `features/redesign-flow-11-brand-web-conversions/04-preview/mockups/web.html` | new (mirror) | +764 |
| `features/redesign-flow-11-brand-web-conversions/04-preview/workflow-prediction.md` | new | +95 |
| `features/redesign-flow-11-brand-web-conversions/05-impact.md` | this file | +80 |
| `features/redesign-flow-11-brand-web-conversions/06-diff/notes.md` | new (post-impl) | +60 |
| `features/redesign-flow-11-brand-web-conversions/lock.json` | new | +35 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `backend/migrations/**` — zero changes
- `Packages/shared/api/**` — zero changes
- `Packages/Mobile/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes (`brandApi.get`,
  `getEnquiries`, `updateEnquiry` consumed as-is)
- All API call shapes (request bodies, query params, response field names)
  frozen
- Form field names — n/a (this page only reads + does one PATCH with the
  same body shape as today)
- Route name `/dashboard/conversions` — unchanged
- localStorage / cookies — untouched
- Role gate — unchanged (`requireRole('brand')` on both endpoints)

## What changes (UX + visual)

- Multi-color summary grid (4 tiles, blue/gray/purple/green) → INK hero
  (3 mono KPIs)
- Separate "channel breakdown" block + separate "type filter" pill row →
  one clickable channel chip row that does both
- Table-style enquiries grid → row-card feed (consistent with Orders)
- Enquiry detail modal → inline expand (consistent with Orders)
- All numbers / dates / IDs / handles now in JetBrains Mono
- Relative dates ("2h ago") replace `toLocaleDateString` in row meta
- New surface: status filter chips for Orders (uses existing backend
  `?status=` support; OLD UI didn't expose this)
- New surface: `deal_value` shown on converted enquiry rows (was stored,
  never rendered)
- New surface: rental-block fields on prebook rows
  (pickup_date/return_date/duration_days/pickup_type)
- New surface: booking_notes on row expand
- Dead-color cleanup (adjacent-fix): drop `new` and `contacted` enquiry
  status colors from OLD page; map to canonical `submitted` / `responded`
  / `converted` / `closed`

## Risks · mitigations

| Risk | Mitigation |
|---|---|
| OLD-page status enum vs new enum mismatch (e.g. backend returns `new`?) | Verified backend writes `submitted` on INSERT (`enquiry.controller.js:38`); PATCH accepts whatever the brand chooses but the UI only writes `converted`. `new`/`contacted` are OLD-UI phantoms. Safe to drop. |
| Status-count derivation differs between tabs (per-page filter loaded) | Same per-tab-count discipline as Flow 10: counts only fully accurate on the "All" filter; show `—` or last-known on filtered tabs |
| CSS cascade breaking brand-web globals (Flow 7 hover-invisible incident) | Apply scoping discipline from day 1: every rule under `.cnv`; every hover re-asserts color; every disabled locks bg + color |
| Backend returns null for `summary` block on edge case | OLD page already handles via `?? 0` fallback; we preserve the same fallback |
| Existing prompt-based deal_value capture is ugly | Out of scope. Leave the `prompt()` — replacing it with inline input adds form-state complexity outside this flow's mandate. Founder can carve a follow-up if desired. |

## Time estimate

~90 min focused work: rewrite page.js (~60 min) + run QA + manual smoke
on a brand session (~20 min) + diff notes + lock.json release block
(~10 min).

## Deploy class

**production-impacting** — `git push origin main` triggers Vercel
auto-deploy of brand-web. Web-only flow; no `Packages/Mobile/src/**`
touched, so `release.maestro_green = "n/a"` per Flow 9/10 pattern. Surface
for explicit go after `pnpm qa` 73/73 GREEN; never silent.
