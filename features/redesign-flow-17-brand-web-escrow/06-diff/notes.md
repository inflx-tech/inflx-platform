# Flow 17 · diff notes — what shipped

## Shipped vs mockup

Single-page restyle implementing all 3 mockup states (normal data view · conversion-only notice · empty state) under `.esc` wrapper.

### `escrow/page.js` (155 → 239 LOC)
- Crumb with navigable back-links (campaigns → this-campaign → escrow)
- Header: count chip + Outfit H1 + yellow rule + campaign.name sub
- **State A · normal data view**: INK 4-KPI hero (Total / Locked yellow / Released light-green / Queued light-info) + per-influencer cards with palette tranche rows (status icon palette + Outfit Tranche N + mono trigger_event + mono amount + status pill)
- **State B · conversion-only**: yellow-pale gradient notice card with 💸 + Outfit heading + body + "Open Conversions tab →" link (router.push to `?tab=conversions`)
- **State C · empty**: yellow-pale gradient empty card with 🔒 icon
- Loading + error states palette-aligned

## Honest divergences
- OLD inline `<a href>` breadcrumbs/links → router.push handlers (allows client-side nav without full page reload; same destinations)
- OLD `text-emerald-600` for released status → `var(--success-text)` palette mapping
- Conversion-only notice color flipped from orange→yellow (palette-aligned, more on-brand)

## CSS scoping — verified
- `.esc .crumb a:hover{color:var(--ink)}` — color re-asserted ✓
- `.esc .notice-conv a:hover{color:var(--ink)}` — color re-asserted ✓
- `.esc .inf-card:hover{border-color:var(--muted-3)}` — only border changes ✓

Same lineage as Flows 7-16.

## QA evidence
- **1st run**: 72/75 (3 transient backend-direct API tests timed out cold — environmental, same pattern as Flow 15 1st run)
- **2nd run**: **75/75 passed · 0 failed · gate 0 · STATE=GREEN** (44s)
- Report: `qa/reports/2026-05-25T07-21-18-257Z/QA-REPORT.md`
- Classification per `feedback_qa_governance.md`: 1st-run failures = environmental (N backend-direct tests failing simultaneously, recovered on 2nd run); no Flow 17 code regression. Stale-server cleanup applied (Flow 12 lesson).

## LOC
- OLD: 155 → NEW: 239 (+84, mostly scoped CSS block)
- Mockup: 292 LOC

## Adjacent-fixes shipped
- Undefined Tailwind tokens (text-t1/t2/t3, border-border, text-yellow-600, text-blue-700, text-emerald-600, bg-yellow-50, bg-blue-50, bg-emerald-50, border-yellow-200, border-blue-200, border-emerald-200, bg-orange-50, border-orange-200, text-orange-700/800/900) → palette CSS vars
- Multi-color status mappings (queued yellow / locked blue / released emerald) → palette mapping (queued=yellow-pale, locked=info-pale, released=success-pale)
- Orange conversion-only notice → yellow-pale gradient palette
- Bordered loading "Loading..." text → palette spinner
- Bordered "No escrow entries" → yellow-pale gradient empty card

## Brand-web bucket complete
**Flow 17 = the final surface for brand-web.** Per handoff §5 locked sequence, next bucket = **mobile brand** (`Packages/Mobile/src/screens/brand/**`).
