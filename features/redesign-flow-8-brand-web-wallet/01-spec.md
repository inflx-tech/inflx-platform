# 01 · Spec — Flow 8 / brand-web wallet

## What this flow is

The brand-side wallet surface. Single Next.js route, single file:
`Packages/brand-web/app/dashboard/wallet/page.js` (348 LOC today).

## Scope

**Pure visual + UX restyle + 1-line adjacent-fix.**

- Same 4 wallet API endpoints, same field shapes
- Same Razorpay top-up flow (paise only at API boundary, rupees in client state)
- Same bank-details JSON shape under `brands.listing_data.bank_details`
- Locked wave2 palette replaces wave1 (`text-teal / text-navy / text-orange / from-red to-orange` → white + ink + yellow)
- **Adjacent-fix**: low-balance threshold `1000000` (paise-era) → `10000` (rupees-era ₹10K); cleanup stale comment

## Layout structure

**2-column on desktop, single-column on mobile:**

| Region | Content |
|---|---|
| **Main** (1fr) | Hero wallet card · KPI strip · Top-up section · Transaction history with filter chips |
| **Right rail** (320px) | Bank account form · "How wallet works" tips |

## Backend audit — verified-twice (zero phantom fields)

| Field | Source | Status |
|---|---|---|
| `wallet.wallet_balance` | `brands.wallet_balance` (rupees since migration 021) | real ✓ |
| `wallet.escrow_locked` | `SUM(wallet_transactions WHERE type='escrow_lock' AND direction='debit')` | real ✓ |
| `wallet.total_deposited` | `SUM(wallet_transactions WHERE type='topup' AND direction='credit')` | real ✓ |
| transaction rows | `wallet_transactions.*` (id, type, amount, direction, description, created_at) | real ✓ |
| transaction types | topup · escrow_lock · escrow_release · refund · platform_fee · payout (all valid enum values) | real ✓ |
| bank details | `brands.listing_data.bank_details` JSON via `brandApi.updateMe()` | real ✓ |

Every visible value traces to a real backend field. No phantom rollups.

## Endpoints used (preserved verbatim)

- `walletApi.getBalance` → `GET /brands/me/wallet`
- `walletApi.createTopup(amount)` → `POST /brands/me/wallet/topup`
- `walletApi.verifyTopup(data)` → `POST /brands/me/wallet/topup/verify`
- `walletApi.getTransactions(params)` → `GET /brands/me/wallet/transactions`
- `brandApi.getMe` → reads `listing_data.bank_details`
- `brandApi.updateMe({ listing_data })` → merges `bank_details` block

## Adjacent-fix detail

OLD line 195:
```js
{/* Low balance warning — balance is in paise; 10000 paise = ₹100 */}
{balance < 1000000 && (...)}
```

The comment is stale — `brands.wallet_balance` is rupees since
migration 021. The `1000000` threshold means "warn when balance <
₹10 lakhs" — the banner is essentially always-on for every brand.

NEW:
```js
{/* Low balance warning — practical floor to publish a small campaign */}
{balance < 10000 && (...)}
```

Threshold of ₹10K covers ~3-4 micro-influencers + the 8% platform
fee. Below that, the brand can't realistically publish anything.

## Out of scope

- Backend changes (none — all 4 endpoints unchanged)
- API shape changes (none)
- Field name / column changes (none)
- Razorpay payment flow changes (none — same order create → checkout → verify)
- Migration / DB changes (none)
- Bank-details validation rule changes (same: holder + account + IFSC required)
