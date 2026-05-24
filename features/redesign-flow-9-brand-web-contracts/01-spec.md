# 01 · Spec — Flow 9 / brand-web contracts inbox

## What this flow is

Brand-side inbox of contracts that the influencer has signed and are now
waiting on the brand's countersignature. Single Next.js route, single
file: `Packages/brand-web/app/dashboard/contracts/page.js` (194 LOC today).

## Scope

**Pure visual + UX restyle.** Same 2 API endpoints + 1 read, same bulk-
sign confirm/post flow, same wallet-short gating, same selection logic.
Locked wave2 palette replaces wave1. Two backend-loaded fields that go
unused today (`formats_json`, `followers_count`) get surfaced as small
contextual chips on each row.

## Layout structure

Single column max-w-5xl (this is an inbox — no rail needed):

1. **Header** — Outfit H1 + yellow rule + mono count chip + ghost Refresh
2. **Wallet status strip** (NEW) — small ink/yellow strip showing
   `Wallet ₹X · Selected lock ₹Y · Short by ₹Z` with progress bar.
   Always visible (vs only-when-selected today).
3. **Sticky bulk action bar** — select-all + count · ink "Sign selected" button
4. **Contract row cards** — checkbox + @handle + tier chip + campaign-name + signed-date + production-mode chip + **format chips (NEW from formats_json)** + **followers count (NEW from followers_count)** + mono Lock ₹ on right + Review link
5. **Empty / loading / error / success states** — locked-palette tones

## Backend audit — verified-twice (zero phantom fields)

| Field | Source | Status |
|---|---|---|
| `c.id` / `c.status` | `contracts.id, status` | real ✓ |
| `c.instagram_handle` | `influencers.instagram_handle` (joined) | real ✓ |
| `c.goal` | `campaign_sets.goal` (joined) | real ✓ |
| `c.campaign_name` / `c.campaign_id` | `campaigns.name, id` (joined) | real ✓ |
| `c.influencer_signed_at` / `c.created_at` | `contracts.*` | real ✓ |
| `c.production_mode` | `contracts.production_mode` | real ✓ |
| `c.influencer_fee` / `c.bonus_amount` | `contracts.*` | real ✓ |
| `c.platform_fee_pct` | `brands.platform_fee_pct` (joined) | real ✓ |
| **`c.formats_json`** (NEW use) | `campaign_sets.formats_json` (joined; already loaded) | real ✓ |
| **`c.followers_count`** (NEW use) | `influencers.followers_count` (joined; already loaded) | real ✓ |
| `wallet.wallet_balance` | `brands.wallet_balance` (verified Flow 8) | real ✓ |

All fields verified in `backend/src/controllers/contract.controller.js:1171-1205` (the `listBrandPending` SELECT). Two fields ALREADY loaded by the backend join — surfacing them in the new design is a pure consumption change, no backend touch needed.

## Endpoints used (preserved verbatim)

- `contractApi.listPending` → `GET /contracts/brand/pending`
- `contractApi.bulkSign(ids)` → `POST /contracts/bulk-sign` (max 100, status-validated server-side)
- `walletApi.getBalance` → `GET /brands/me/wallet`

## Out of scope

- Backend changes (none — both fields already in the SELECT)
- API shape changes (none)
- Selection logic / bulk-sign confirm flow / wallet-short gating (preserved)
- The Review link target — keeps pointing at `/dashboard/campaigns/[id]` (Flow 6 hub)
