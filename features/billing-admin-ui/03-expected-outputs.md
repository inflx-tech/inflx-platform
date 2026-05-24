# Expected Outputs — billing-admin-ui (Phase A7-admin)

## Backend endpoints (all under /v1/admin)
| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/subscription-tiers` | any admin | `{tiers: SubscriptionTier[]}` |
| PATCH | `/subscription-tiers/:tierKey` | superadmin | `{tier: SubscriptionTier}` |
| GET | `/categories` | any admin | `{categories: Category[]}` |
| POST | `/categories` | superadmin | `{category: Category}` (201) |
| PATCH | `/categories/:categoryKey` | superadmin | `{category: Category}` |
| DELETE | `/categories/:categoryKey` | superadmin | `{deleted: string}` |
| GET | `/subscriptions` | any admin | `{subscriptions: BrandSub[], total: int}` |
| GET | `/subscription-invoices` | any admin | `{invoices: Invoice[], total: int}` |

Standard envelope `{success, data}` / `{success:false, error:{code, message, field?}}`.

## UI surface (4 new pages)
- All visual style mirrors `/admin/escrow-fees` (admin-web) — Tailwind tokens `bg-navy`, `text-t1/t2/t3`, `bg-surface2`, `border-border`, `font-display`. Same edit-mode-toggle / row-by-row save pattern.

## Test outputs
- 7 new backend jest assertions GREEN.
- 4 new Playwright nav-sweep routes pass (existing breadth-net guarantee: page resolves without auth bounce, HTTP < 400).
- `pnpm qa` total 71 routes (was 67 → +4 nav-sweep entries), STATE=GREEN, gate=0.

## Functional output after this ships
- Admin can EDIT every numeric in the revenue model without a code change:
  - 4 subscription tier prices + 4 quota limits per tier.
  - 16 categories × 3 path percentages.
  - Add new categories (e.g. when a new business vertical lands).
- Admin can MONITOR:
  - Every active brand subscription with mandate state + next charge.
  - Every invoice (paid/pending/failed/refunded) with filters.
- L2 escrow tiers continue to be edited via the existing `/admin/escrow-fees` page (admin-web, M037). Out of scope to mirror in brand-web here.

## Deploy posture
PRODUCTION-IMPACTING (Packages/brand-web/app/admin/** + backend/src/**).
Push triggers Render redeploy (new admin endpoints) + Vercel redeploy (new admin pages). RAZORPAY_MOCK still true on prod — these are admin-config pages, not customer-facing payment flows; no Razorpay touch in A7-admin.
