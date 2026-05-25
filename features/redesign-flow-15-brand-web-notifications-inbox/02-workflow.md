# Flow 15 · workflow — happy paths preserved

---

## Notifications page

### W1 · Brand lands on /dashboard/notifications
1. `useEffect` fires `notificationApi.list()` once
2. Populate `notifications[]` + `unread`
3. Render header with count chip + Mark-all-read button (when unread > 0)
4. Render row cards with palette type avatars

### W2 · Brand clicks "Mark all read"
1. `notificationApi.markAllRead()` mutation
2. On success → re-fire `list()` (preserved verbatim)
3. unread chip updates · all unread-style cards become read-style

### W3 · Empty / loading
- Loading: spinner
- Empty: yellow-pale gradient empty card with "No notifications yet"

## Inbox page

### W4 · Brand lands on /dashboard/inbox (default tab = applications)
1. URL `?tab=` parsed via `useSearchParams` (wrapped in `Suspense`)
2. Default tab = `applications` when not specified
3. `brandInboxApi.summary()` fires once on mount to populate header count + sub-tab counts
4. Active tab's data fetched (per-tab `useEffect`)

### W5 · Brand switches tab
1. Click sub-tab pill → `router.push('/dashboard/inbox?tab=<key>')`
2. URL updates, page re-renders with new active tab
3. New tab's data fetched if not yet loaded

### W6 · Applications tab — Approve / Reject
1. Brand clicks Approve or Reject on an application row
2. For Reject: `confirm('Reject @handle?')` preserved
3. Set busy state for that row (disables both buttons)
4. `applicationApi.approve(campaign_id, ci_id)` or `reject(campaign_id, ci_id)`
5. On error: `alert(error.message || 'Could not action')` preserved
6. On approve success with `slots_filled`: `alert('Approved. Slots now full — N other applicants notified')` preserved
7. Reload applications list via `load()`

### W7 · Negotiations / Reviews tab — Click row to navigate
1. Row click → `router.push('/dashboard/campaigns/{id}')` (negotiations) or `router.push('/dashboard/campaigns/{id}?tab=content&deliverable={id}')` (reviews)

### W8 · Signatures tab
- Renders single info card with instruction text + summary count
- No actions (brand follows instruction to navigate)

### W9 · Failures tab
- Loads `brandInboxApi.summary()` (already loaded by W4)
- Renders 2 info cards with `contracts_failed` + `pdf_failed` mono counts + instructions
- No actions (brand follows instructions per-card)

---

## Mutation-preservation contract (frozen)

- `notificationApi.markAllRead()` body unchanged
- `applicationApi.approve(campaign_id, ci_id)` signature unchanged
- `applicationApi.reject(campaign_id, ci_id)` signature unchanged
- Confirm/alert dialog copy preserved verbatim

## Query-param contract (frozen)

- Inbox URL: `?tab=applications|negotiations|reviews|signatures|failures`
- Backend endpoints: no query params consumed except `negotiations('awaiting_brand')` and `deliverables('submitted')` — both preserved
