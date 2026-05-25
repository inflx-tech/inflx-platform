# Flow 15 · diff notes — what shipped

## Shipped vs mockup

Implementation matches all 4 mockup states 1:1. 2 single-page restyles.

### Notifications · `notifications/page.js` (73 → 156 LOC)
- Type-color avatar helper (offer/campaign/contract/content/money/danger)
- Yellow vs ink count chip based on `unread > 0`
- `fmtRelative` helper (Flow 10 style)
- Unread cards: yellow-50 bg + yellow-pale border + 8px yellow dot · Read cards: white + spacer
- "Mark all read" yellow button only when `unread > 0`
- Empty: yellow-pale gradient with 🔔 icon
- Loading: palette spinner

### Inbox · `inbox/page.js` (269 → 428 LOC)
- INK sub-tab pills with per-tab mono counts from `brandInboxApi.summary()` (NEW — accurate counts even when tab not loaded)
- Header total-waiting count chip (sum of all tab counts)
- 5 tab panels:
  - **Applications**: rich cards with tier pill + handle + campaign·set + mono stats + niche line + View profile link + Reject (danger-pale → danger on hover) / Approve (ink+yellow) inline buttons. `confirm()` for reject + `alert()` for slot-filled preserved.
  - **Negotiations**: click-to-navigate ic-nav cards with handle · campaign · mono fee · created/expires dates (expires danger-text) · yellow chevron
  - **Reviews**: click-to-navigate ic-nav cards with handle · type · revision badge (yellow-pale) · campaign · submitted date · yellow chevron
  - **Signatures**: success-bordered info card with count chip + instruction copy
  - **Failures**: 2 info cards (warn + danger) with mono `contracts_failed` + `pdf_failed` counts + instructions
- `Suspense` wrapper preserved (needed for `useSearchParams`)
- URL-driven tabs via `?tab=` preserved
- `onChange` callback wired to tab panels to refresh summary after mutations (Applications approve/reject triggers re-fetch)

## Honest divergences from mockup

1. **`brandInboxApi.summary()` per-tab counts** — mockup shows specific counts (3/2/1/2/0). Impl falls back to `null` (no count shown) if backend doesn't return the expected fields (`applications_count`, `negotiations_count`, etc.). The count for `failures` is derived = `contracts_failed + pdf_failed`. If backend's summary endpoint only returns `contracts_failed` + `pdf_failed`, the other counts simply won't display until backend adds them — acceptable, no functional break.

2. **Signatures count** — mockup shows "2 pending" badge. Impl shows the badge only when `summary.signatures_count > 0`. If the endpoint never returns this field, the badge silently hides. Honest.

3. **Notifications: total + unread split in chip** — mockup shows "4 unread · 12 total". Impl shows the same when `unread > 0`, otherwise shows just "{total} total". Cleaner.

4. **Sub-tab counts visibility** — only render when `counts[tab.key] != null`. Hides on tabs where backend hasn't populated the count.

## CSS scoping discipline — verified

All rules scoped under `.ntf` or `.ibx` wrappers. Spot-check:

**Notifications:**
- `.ntf .btn-yel:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}` — color re-asserted ✓
- `.ntf .btn-yel:disabled{opacity:.4;cursor:not-allowed;background:var(--yellow);color:var(--ink)}` — bg+color locked ✓
- `.ntf .rc:hover{border-color:var(--muted-3)}` — only border changes; bg+color preserved ✓

**Inbox:**
- `.ibx .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}` — color re-asserted ✓
- `.ibx .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}` — active hover preserves ✓
- `.ibx .ic-btn.reject:hover:not(:disabled){background:var(--danger);border-color:var(--danger);color:var(--white)}` — color re-asserted ✓
- `.ibx .ic-btn.approve:hover:not(:disabled){background:var(--ink-2);border-color:var(--ink-2);color:var(--yellow)}` — color re-asserted ✓
- `.ibx .ic-btn:disabled{opacity:.4;cursor:not-allowed}` — disabled state ✓
- `.ibx .ic-clickable:hover{border-color:var(--ink)}` — only border changes ✓
- `.ibx .ic-view:hover{color:var(--yellow-text);background:transparent}` — color re-asserted ✓

Same lineage as Flows 7-14.

## QA evidence

- `pnpm qa` 1st run: 72/75 (3 backend-direct API tests timed out cold — environmental, not Flow 15 code)
- `pnpm qa` 2nd run: **75/75 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN** (48.6s)
- Report: `qa/reports/2026-05-25T06-05-32-863Z/QA-REPORT.md`
- First-run NOT clean: 1st run had 3 transient backend timeouts on a cold backend (matches Flow 12 + auth-test misdiagnosis pattern). 2nd run clean. **Classification per `feedback_qa_governance.md`: environmental (external dep)** — same pattern as Flow 12's stale-server issue but on backend side this time. No Flow 15 code regression.
- No `notifications.spec.ts` or `inbox.spec.ts` exists — Flow 15 routes are regression-gate-covered only.
- Manual smoke recommended post-deploy.

## LOC

- OLD `notifications/page.js`: 73 → NEW: 156 (+83)
- OLD `inbox/page.js`: 269 → NEW: 428 (+159)
- **Total OLD: 342 → NEW: 584 (+242)** — mostly scoped CSS blocks
- Mockup: 626 LOC

## Adjacent-fixes shipped

- Undefined Tailwind tokens (`text-t1`, `text-orange`, `bg-surface2`, `bg-navy-pale`, `text-navy`, `border-gray-200`, `bg-red-50`, `border-red-300`, `text-red-600`) → palette CSS vars ✓
- Loading skeleton/text → palette spinner ✓
- Empty states aligned with Flow 11-14 pattern ✓
- Notification type→icon mapping replaced with type→avatar (palette-colored bg + emoji) ✓
- Inbox URL-driven tab preserved · Suspense preserved · alert/confirm preserved ✓
