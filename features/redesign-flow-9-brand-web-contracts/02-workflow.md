# 02 · Workflow — Flow 9

## End-to-end happy paths (preserved verbatim)

### Page load
1. Brand visits `/dashboard/contracts`
2. Two parallel fetches: `contractApi.listPending()` + `walletApi.getBalance()`
3. Contracts list renders (rows ordered by `influencer_signed_at DESC`)
4. Wallet status strip renders from balance
5. Empty state if `contracts.length === 0`

### Select + bulk sign
1. Brand ticks individual checkboxes OR "Select all"
2. Wallet strip live-updates: `Selected lock ₹Y · Short by ₹Z` (when total lock > balance)
3. "Sign selected" button disabled while `walletShort === true` (server-side will also reject; client mirror is for UX)
4. Click "Sign selected (N)" → `window.confirm(...)` dialog with summary
5. On confirm → `contractApi.bulkSign(ids)` → server-side per-contract validation (status = `pending_brand` only; `WALLET_INSUFFICIENT` if total lock exceeds wallet at moment of call; max 100 ids)
6. On success → green toast + clear selection + refresh list + refresh wallet
7. On failure → red banner with backend error message + selection preserved (so brand can retry)

### Refresh
- Click "Refresh" → identical to page-load fetches

### Review link per row
- "Review →" navigates to `/dashboard/campaigns/{c.campaign_id}` (the Flow 6 hub for that campaign)

## Error states (preserved)

- `contractApi.listPending` fails → error banner + empty list
- `contractApi.bulkSign` fails → error banner + selection preserved
- Wallet API fails → silently skipped (wallet strip just won't render the balance figure)

## NO-TOUCH preserved

- All backend endpoints + every request body shape
- Selection set semantics
- Bulk-sign confirm dialog with summary
- Wallet-short client-side gating (server enforces too)
- Page-load order (contracts + wallet in parallel via `Promise.all`)
- Brand-approval gate inherited from `layout.js`
