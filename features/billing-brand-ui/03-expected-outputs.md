# Expected Outputs — billing-brand-ui (Phase A7-brand)

## Pages reachable
- `/dashboard/subscription` — renders for an approved brand. Heading "Subscription"; sub-headings "Current plan", "Usage this cycle", "Available plans". 4-tier grid with Choose buttons.
- `/dashboard/billing` — renders for an approved brand. Heading "Billing", GST 18% disclosure. Invoice table OR empty state.

## API contracts (no new endpoints — all shipped earlier)
Stable across A6 → now:
- `GET /v1/subscription-tiers` → `{ tiers: [{tier_key, name, monthly_price_inr, max_*, is_enterprise, active, sort_order, description}] }`
- `GET /v1/brands/me/subscription` → `{ subscription:{...}, tier:{...}, usage:{campaigns, products, influencer_invites_this_cycle} }`
- `POST /v1/brands/me/subscription/upgrade {tier_key}` → `{ subscription:{...}, invoice:{...} }` (mock-mode)
- `GET /v1/brands/me/billing/invoices?limit=` → `{ invoices: [{id, tier_key, amount_inr, gst_amount_inr, total_inr, period_*, status, paid_at}] }`

## Nav
- 2 new entries added to `NAV` array in `Packages/brand-web/app/dashboard/layout.js`.
- Final NAV length: 14 (was 12 + 2).
- Order: …Wallet, **Subscription, Billing**, Profile.

## QuotaWallModal exports
- Default export: `<QuotaWallModal quota={…} onClose={…} />` — renders nothing if `quota==null`.
- Named: `useQuotaWall()` → `{ quota, showFromResponse(res), show(details), close() }`.
- Named: `isQuotaError(res)` → boolean predicate.

## Test results
- `qa/web/brand/subscription-billing-nav.spec.ts` — 2 PASS.
- `pnpm qa` 73/73 GREEN (71 prior + 2 new), STATE=GREEN, gate=0.

## Deploy posture
PRODUCTION-IMPACTING on push: Vercel redeploys brand-web with 2 new
pages + 2 nav entries + 1 reusable modal. No backend / mobile change.
