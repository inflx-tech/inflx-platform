# billing-brand-ui — brand subscription + billing pages + quota-wall modal (Phase A7-brand)

> **Phase A7-brand of the INFLX 3-Layer Revenue Model.** Founder
> override on 2026-05-24: "do one thing, you start design pages, later
> i will change." Ships now without Window B foundation, matching the
> existing wave2 dashboard locked palette so it slots in cleanly; full
> restyle deferred to the founder later.

## What ships

**Pages (2)** in `Packages/brand-web/app/dashboard/`:
- `subscription/page.js` — current plan card (tier + status + price +
  cycle dates + mandate state) + usage card (campaigns / products /
  invites-this-cycle vs limits with over/near indicators) + 4-tier
  comparison grid with "Choose <tier>" upgrade buttons.
- `billing/page.js` — invoice history table (id / tier / period /
  amount / GST / total / status / paid-at) + summary stat tiles.

**Component (1)**:
- `Packages/brand-web/components/QuotaWallModal.js` — reusable modal
  triggered when a backend mutation returns `error.code='QUOTA_EXCEEDED'`.
  Exports `<QuotaWallModal/>`, `useQuotaWall()` hook, `isQuotaError(res)`
  predicate. Standalone — pages opt-in via import; not wired into any
  page in this commit (Window-B collision avoidance), founder can wire
  per-page in follow-up.

**API client** (`Packages/brand-web/lib/api.js`):
- `brandApi.listSubscriptionTiers()` → `GET /v1/subscription-tiers`
- `brandApi.getMySubscription()`     → `GET /v1/brands/me/subscription`
- `brandApi.upgradeSubscription(tier_key)` → `POST /v1/brands/me/subscription/upgrade`
- `brandApi.getMyInvoices(params)`   → `GET /v1/brands/me/billing/invoices`

**Nav** (`Packages/brand-web/app/dashboard/layout.js`):
- 2 new entries: Subscription (◆) + Billing (◧), inserted between
  Wallet and Profile to keep the existing 12 items un-reordered.

**Tests** (`qa/web/brand/subscription-billing-nav.spec.ts`):
- 2 specs — each new page reachable by brand session, renders heading +
  key landmarks, with permissive stubs for the 4 new endpoints.

## What does NOT ship in this contract
- Quota-wall modal is **not wired** into existing pages (products,
  campaigns, sets, invites). Wiring touches pre-existing dashboard
  pages that Window B will restyle — explicit defer to avoid collision.
- Razorpay live mode — still `RAZORPAY_MOCK=true` on prod; upgrade
  endpoint runs mock-mode (writes paid invoice immediately, no real
  charge). Real Razorpay UPI Autopay mandate flow is Phase A6.5,
  separate follow-up.
- Mobile pages — out of scope (mobile follower app does not need
  subscription / billing surfaces; brand mobile app is in Window B's
  later phases).

## Backend endpoints reused (all shipped earlier)
Endpoints used by these pages all shipped in Phases A6 + A7-admin:
- `GET /v1/subscription-tiers` (A6, public)
- `GET /v1/brands/me/subscription` (A6)
- `POST /v1/brands/me/subscription/upgrade` (A6, mock mode)
- `GET /v1/brands/me/billing/invoices` (A6)

No new endpoints in this contract.

## Visual approach — explicit decision
Pages use the same locally-scoped CSS / wave2 locked palette pattern
as `/dashboard/wallet/page.js`:
- white card / `bg=#FAFAFA` / `ink=#0A0A0A` / `success=#16A34A` etc.
- Outfit font, 12px gap grid, 12px border-radius cards.
- No imports from `Packages/shared/theme/**` (Window B will land tokens
  there later; founder will wire pages to tokens at that point).

This is **not** the final design. It's the same look-and-feel as the
rest of the existing dashboard so brand users see continuity. Founder
will iterate the visual surface in a future contract.

## Files
- `Packages/brand-web/app/dashboard/subscription/page.js` (new)
- `Packages/brand-web/app/dashboard/billing/page.js` (new)
- `Packages/brand-web/components/QuotaWallModal.js` (new)
- `Packages/brand-web/app/dashboard/layout.js` (2 nav items added)
- `Packages/brand-web/lib/api.js` (4 brandApi methods added)
- `qa/web/brand/subscription-billing-nav.spec.ts` (new, 2 specs)
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING (Vercel redeploys brand-web).
- Mobile untouched → OTA skipped.
- Backend untouched (endpoints already live).
- Brand session auth via existing cookie+localStorage pattern.
