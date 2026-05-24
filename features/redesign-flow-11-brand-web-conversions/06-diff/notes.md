# Flow 11 · diff notes — what shipped

## Shipped vs mockup

The implementation matches all 4 mockup states 1:1. Notes on every
material element:

### State 1 — Orders tab default

- ✅ Count chip `{N} TRANSACTIONS` driven by `meta.total`
- ✅ Outfit H1 + yellow rule + sub-line (locked palette)
- ✅ INK hero with 3 KPIs (Total Revenue / Your Net (yellow) / Commission Paid)
  driven by `summary.total_revenue` / `summary.total_brand_net` / `summary.total_commission`
- ✅ Channel chip row (3 cards) clickable as filters
- ✅ Sub-tab pills with mono counts
- ✅ Status filter chips (5: All / Completed / Initiated / Returned / Refunded)
  using existing backend `?status=` query support
- ✅ Row cards (no table) — every row = badge / name·product / amount / status / relative date

### State 2 — Orders row expanded (inline)

- ✅ Inline expand replaces OLD modal pattern
- ✅ Financial waterfall (8 fields)
- ✅ Rental block (8 fields) — surfaces 4 previously-unused backend fields:
  `pickup_date`, `return_date`, `duration_days`, `pickup_type`
- ✅ Booking-notes card — surfaces previously-unused `fb.notes`
- ✅ Non-rental booking row branch keeps `booking_date`, `booking_ref`,
  `order_status`, `follower_phone` rendering when applicable

### State 3 — Enquiries tab expanded

- ✅ Inline expand replaces OLD modal pattern
- ✅ Status filter chips for enquiries (5: All / Submitted / Responded / Converted / Closed)
- ✅ Dead OLD-UI status colors (`new`, `contacted`) silently dropped
  (adjacent-fix) — replaced with canonical backend values
- ✅ `deal_value` surfaced on converted rows (was stored, never rendered before)
- ✅ form_data fields render as 2-col cards; long values auto-promoted to wide
- ✅ Convert button hidden when status === 'converted'
- ✅ `prompt()`-based deal_value capture preserved per 05-impact (out of scope to redesign)

### State 4 — Empty

- ✅ Yellow-pale gradient empty card with ✓ icon (Outfit + sub-line)
- ✅ Hero KPIs render `₹0` from the always-present backend summary block
- ✅ Channel chips show `0`

## Honest divergences from mockup

1. **Wallet/contracts/proposals-style top nav not present in implementation.**
   The mockup showed a simulated sidebar (`[LOGO] Dashboard Campaigns ...`).
   The real brand-web has its own `layout.js` that supplies the sidebar — my
   `page.js` change touches only the route content area. This matches every
   prior Flow (6/7/8/9/10) — the sidebar is part of the shared layout.

2. **"Send response" button shown in mockup State 3 is NOT in the impl.** The
   backend has no `responded` PATCH wired with a body shape that captures the
   response text. Surfacing a non-functional button is dishonest UX. Out of
   scope for Flow 11; if founder wants it, carve a separate
   `features/brand-respond-to-enquiry/` contract that adds the backend route
   first.

3. **Per-status TX counts** show `—` when the user is not on the bare default
   view (no type filter, no status filter, all rows on page 1). This is the
   Flow 10 per-tab-count discipline applied honestly — derived counts can only
   reflect the loaded subset, so we don't lie about totals. On the bare view
   counts are exact. Documented in 02-workflow.md.

4. **Channel chips remain visible on the Enquiries tab** but become disabled
   (greyed out) rather than hidden. Reasoning: the visual layout stays stable
   across tabs; disabling is clearer about why they don't react than hiding.

## CSS scoping discipline — verified

All rules scoped under `.cnv` wrapper (specificity 0,2,0 beats Tailwind utilities 0,1,0). Spot-check:

- `.cnv .btn-convert:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.cnv .btn-convert:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg + color both locked ✓
- `.cnv .ch-card:hover:not(:disabled){border-color:var(--muted-3);color:var(--ink);background:var(--white)}` — color re-asserted ✓
- `.cnv .ch-card.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--white)}` — active hover preserves ink bg + white text (no cascade collapse) ✓
- `.cnv .ch-card:disabled{opacity:.55;cursor:not-allowed;background:var(--white);color:var(--ink)}` — bg + color locked ✓
- `.cnv .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}` — color re-asserted ✓
- `.cnv .pg-btn:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}` — color re-asserted ✓
- `.cnv .tc-row:hover:not(:disabled){background:transparent;color:var(--ink)}` — color re-asserted ✓
- `.cnv .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}` — color re-asserted ✓

Same discipline as Flow 9 (`.cts`) + Flow 10 (`.prp`). No latent hover-invisible traps.

## QA evidence

- `pnpm qa` first-run clean: **75/75 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN**
- Duration: 34.7s
- Report: `qa/reports/2026-05-24T13-54-31-724Z/QA-REPORT.md`
- Test count grew 73 → 75 from Window A's parallel Phase A9 push (`80ba29c
  feat(revenue): Phase A9 — tier features list + quota popup wiring +
  Settings hub`). All 2 new tests pass on first run; Flow 11 changes
  do not touch their surfaces.
- No `conversions.spec.ts` exists — Flow 11 is regression-gate-covered
  only. Acceptable per `feedback_qa_governance.md`; no Playwright
  exercises the route directly today. Manual smoke recommended on the
  live brand session post-deploy.

## LOC

- OLD `page.js`: 393
- NEW `page.js`: 687
- Mockup: 764
