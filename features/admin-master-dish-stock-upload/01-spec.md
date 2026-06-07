# Feature Spec — Admin uploads stock images for master dishes

> Status: LOCKED (founder 2026-06-07 "Build admin file-upload now"). Rides on
> listing-stable-image-urls (permanent media URLs). backend + brand-web admin.

## Problem / goal
The dish catalogue images sellers browse are admin-controlled `master_dishes.default_image_url`.
Admin could only **paste a URL**; the founder wants admin to **upload free stock image files**.
The brand media gallery is brand-scoped (`requireRole('brand')`), so admin can't use it. Goal:
an admin-scoped stock-image upload that stores a **permanent** URL (via the re-sign-on-read
foundation), with an upload button in the admin master-dishes editor.

## Scope
- **In scope:**
  - **Backend:** `mediaService.generateStockUploadUrl` (presigned PUT under a platform
    `stock/dishes/...` key); admin `POST /admin/master-dishes/stock-upload-url`
    (`requireAdminRole('reviewer')`) returning the presigned URL + the **permanent public_url**;
    public **prefix-guarded** serve route `GET /v1/media/stock/*` (re-sign + 302; only
    `stock/` keys, no traversal → never brand assets or contracts).
  - **brand-web admin:** `uploadAdminStockImage(file)` helper + an "⬆ Upload stock image"
    button + thumbnail preview in the master-dishes edit modal; sets `default_image_url` to
    the permanent URL. URL-paste still available as a fallback.
- **Out of scope:** brand/seller upload (already fixed by the foundation); non-dish catalogues;
  bulk image import.

## Surfaces touched
- backend: `media.service.js`, `mediaAsset.controller.js`, `adminMasterDish.controller.js`,
  `routes/index.js`, `routes/admin.routes.js`.
- brand-web: `lib/api.js`, `app/admin/master-dishes/page.js`.

## Data / contracts
- No migration. `master_dishes.default_image_url` now may hold a `/v1/media/stock/...` URL.
- Auth: upload endpoint = `requireAdminRole('reviewer')`; serve route public (images).

## Non-functional
- Failure: upload errors surface inline in the modal; paste-URL fallback remains.
- Safety: stock serve is prefix-guarded to `stock/` (no path to private files).
- Gate: `pnpm qa` green; UI-governed (brand-web) → mockup_locked + 06-diff; Render + Vercel
  deploys surfaced for founder go.
