# Flow 14 · diff notes — what shipped

## Shipped vs mockup

Implementation matches all 3 mockup states 1:1. Single-page restyle · Settings hub layout preserved.

### Profile page · `Packages/brand-web/app/dashboard/settings/profile/page.js`

- ✅ All form behaviors preserved (state management · payload diff logic · branch array manipulation · main-branch identification by `name === 'Main Branch'`)
- ✅ `useEffect` `brandApi.getMe()` populates form/contactName/mainBranch/branches identically
- ✅ Save handler: payload diff against `brand` object, JSON.stringify compare for listing_data, "No changes to save" early-return, success/error toast
- ✅ Branch add/update/remove preserved (no shape change)
- ✅ GSTIN auto-uppercase preserved (`e.target.value.toUpperCase()`)
- ✅ Pincode numeric-only + 6-char max preserved (`.replace(/\D/g, '').slice(0, 6)`)
- ✅ Main Branch literal `'Main Branch'` preserved (backend Primary identifier)

### Layout sections shipped

- **Status banner** (`StatusBanner` extracted as separate component): pending = yellow-pale + `!` icon · rejected = danger-pale + `✕` icon + `rejection_reason` sub-line
- **Logo card**: 80px square thumb (dashed border + "No logo" when empty / solid yellow-pale + initials/img when present) · URL input + "Upload File" tooltip button
- **Business Information card**: business_name (required) · contact_person · phone+category 2-col (locked, 🔒 label, mono) · GSTIN (mono) · Save row with mono "Last updated · {fmtDateTime}" + ink+yellow "Save Changes"
- **Branches & Outlets card**: yellow-ghost "+ Add Branch" right · Main Branch sub-card (success-pale top tint + "Primary" success pill + 6 fields) · Additional branches stack (each with "Remove" danger-text link) · empty hint when no additional branches
- **Account Details card**: 4-cell mono grid (Registered · Approved On if present · Brand ID truncated · Status with palette dot)
- **Toast**: ink success / danger error, bottom-right, auto-dismiss 3.5s

## Honest divergences from mockup

1. **Upload File tooltip** — mockup showed a CSS-only floating tooltip popup. Impl uses simpler approach: button label flips on hover/click between "Upload File" and "Coming soon · use URL" (mono inline). Behavior preserved (button-only placeholder, no real upload).

2. **Logo fallback for broken image URLs** — when `<img onError>` fires, we hide img and reveal a sibling `<span class="em">` with initials. The OLD code used DOM-mutation `e.target.nextSibling.style.display = 'block'`; I preserved the pattern (slightly cleaner React-friendly form with `display: 'none'` initial state on the fallback span).

3. **Status `suspended`** — included in `STATUS_DOT` map (preserved from OLD's STATUS_STYLES). Renders muted color · `suspended` label. Banner doesn't show for suspended (OLD also only banners pending/rejected — preserved).

4. **Brand ID** in Account Details — only renders when `brand.id` is truthy (defensive — most brand objects have it, but defensive against partial responses).

5. **Settings layout** (Window A's Phase A9 hub shell) — UNTOUCHED. The profile page renders inside the layout's `<div>{children}</div>` slot. Layout provides "Settings" H1 + 3 tabs above; profile provides 4 section cards below. **Redundant `<h1>Profile & Settings</h1>` from OLD removed.**

## CSS scoping discipline — verified

All rules scoped under `.prf` wrapper. Spot-check:

- `.prf .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.prf .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}` — bg+color locked ✓
- `.prf .btn-yel-ghost:hover:not(:disabled){background:var(--yellow-pale);color:var(--yellow-text);border-color:var(--yellow)}` — color re-asserted ✓
- `.prf .br-remove:hover{text-decoration:underline;color:var(--danger-text);background:transparent}` — color re-asserted ✓
- `.prf .field-help .tip:hover{border-color:var(--ink);color:var(--ink);background:var(--white)}` — color re-asserted ✓
- `.prf .field input[readonly]:focus,.prf .field input.locked:focus{border-color:var(--border);box-shadow:none}` — read-only focus disabled (prevents misleading focus ring on locked fields) ✓
- `.prf .field input[readonly]{background:var(--bg2);color:var(--muted);cursor:not-allowed;border-color:var(--border)}` — locked styling ✓

Same lineage as Flow 7 patch / Flow 8 preventive / Flows 9–13 day-1.

## Settings hub preservation — verified

`Packages/brand-web/app/dashboard/settings/layout.js` — **NOT touched** (Window A's Phase A9 territory). The layout's `.shub` scoped CSS continues to render the H1 + tabs unchanged. Profile content renders below in `<div>{children}</div>` — the `.prf` rules cannot collide with `.shub` rules (different scope selectors, no shared class names).

Sibling pages NOT touched:
- `settings/subscription/page.js` (Window A's Phase A7-brand)
- `settings/billing/page.js` (Window A's Phase A7-brand)

Old `/dashboard/profile/page.js` redirect — **NOT touched** (6-LOC server redirect to `/settings/profile`).

## QA evidence

- `pnpm qa` first-run clean: **75/75 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN**
- Duration: 52.7s
- Report: `qa/reports/2026-05-25T05-05-57-511Z/QA-REPORT.md`
- First-run clean: **YES** (Flow 12 stale-server lesson applied — killed node procs before run)
- No `settings/profile.spec.ts` exists — Flow 14 route is regression-gate-covered only. Acceptable per `feedback_qa_governance.md`. The existing `subscription-billing-nav.spec.ts` covers the redirect and the sibling Settings tabs renders — all pass.
- Manual smoke recommended post-deploy: load profile page on a real brand account, edit a field, save, verify "Last updated" timestamp moves; toggle to subscription/billing tabs and back to verify layout works.

## LOC

- OLD `page.js`: 603 → NEW: 678 (+75; mostly scoped CSS block + helper functions)
- Mockup: 661 LOC

## Adjacent-fixes shipped

- OLD's undefined Tailwind tokens (`bg-gold`, `text-t1`/`t2`/`t3`, `border-border2`, `border-border`, `bg-surface2`, `bg-red`, `bg-teal-100`, `bg-yellow-100`, `bg-red-100`, `bg-gray-200`, `text-red`, `text-gold`) replaced with locked palette CSS vars ✓
- Inline SVG lock icons (multi-line `<svg><path>`) replaced with 🔒 unicode in clean label tag ✓
- Redundant `<h1>Profile & Settings</h1>` removed (Settings layout already renders "Settings") ✓
- Status banner (amber/red/teal Tailwind tints) → palette pills (yellow-pale/danger-pale/success-pale) ✓
- Loading skeleton restyled to locked-palette spinner ✓
- Toast: navy/red Tailwind → ink/danger palette ✓
- Save button: `bg-gradient-to-r from-red to-orange` → ink+yellow ink button ✓
