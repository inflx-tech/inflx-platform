# Expected Outputs — A10.5

## Backend
- 5 admin route mounts active under `/v1/admin/`:
  - `GET subscription-tiers`, `POST subscription-tiers`, `PATCH subscription-tiers/:tierKey`, `GET subscriptions`, `GET subscription-invoices`.
- `subscription.controller.js` exports `adminCreateTier` alongside existing exports.

## Admin UI
- `/admin/pricing/tiers` lists 4 existing tiers (free, growth, pro, enterprise) with Edit buttons.
- "+ New tier" button visible top-right.
- Modal validates client-side (slug regex, name length).
- Create flow ends with the user navigating to the detail editor.

## API JSON shapes
- `POST /admin/subscription-tiers {tier_key, name, description?}` → `201 {success:true, data:{tier:{...}}}`.
- Duplicate key → `409 {success:false, error:{code:'CONFLICT', message, field:'tier_key'}}`.
- Bad slug → `422 {success:false, error:{code:'VALIDATION_ERROR', message, field:'tier_key'}}`.

## pnpm qa
75/75 GREEN expected — no new specs added in A10.5; existing specs stay green.

## Deploy
PRODUCTION-IMPACTING — Vercel redeploys brand-web (page rewrite), Render redeploys backend (new route mount + new controller export). No DB migration. No mobile.
