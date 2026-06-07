# Feature Spec — Stable (permanent) URLs for uploaded images

> Status: LOCKED (founder 2026-06-07 "pls proceed"). Backend-only. No migration.
> Foundation for: seller "upload your own photo", admin master-dish stock images,
> brand cover photos — anywhere a media asset is stored/displayed.

## Problem / goal
Uploaded images break after ~1 hour. The brand media gallery returns a **1-hour signed
R2 URL** (`mediaService.generateAssetDownloadUrl`, expiresIn 3600) and the uploader stores
it **as-is** into `brand_products.image_url` / `brands.listing_data` (GalleryPicker →
`picked.download_url`). Followers read `image_url` directly with **no re-signing**
(`follower.service.js`), so the URL expires and the image vanishes. This is latent only
because current dishes use the permanent seeded Unsplash stock URLs — the moment a seller
uploads their OWN photo (the flow we just shipped), it dies in an hour. The bucket also
holds **private contracts/KYC**, so a public bucket is NOT an option. Avatars/contracts
already use the correct pattern (store key, re-sign on read). Goal: bring media-asset
images onto the same safe, permanent footing.

## Scope
- **In scope (backend only):**
  - New **public** endpoint `GET /v1/media/assets/:id` → look up the asset, re-sign its
    `file_r2_key`, **302-redirect** to the fresh signed R2 URL. Public (an `<img>` sends no
    token). Reachable only for `brand_media_assets` rows (keyed by DB id; `file_r2_key` is
    always under `brands/<id>/assets/`) — contracts/KYC are not media assets → never exposed.
  - `mediaAsset._enrich` now returns `download_url` = a **stable** URL
    (`<RENDER_EXTERNAL_URL>/v1/media/assets/<id>`) instead of the raw signed URL. Because
    `createAsset`/`listAssets` enrich, the uploader (GalleryPicker → `picked.download_url`)
    now stores the permanent URL automatically — **no frontend change**.
- **Out of scope:** the explicit `GET /me/media-assets/:id/download-url` (kept signed for
  direct file downloads); a data migration of any already-broken stored URLs (none expected
  in prod yet); the admin master-dish stock-upload UI (separate, rides on this).

## Surfaces touched
- backend only: `controllers/mediaAsset.controller.js`, `routes/index.js`. No web/mobile.

## Data / contracts
- No migration. New public route. `download_url` shape becomes a stable app URL (302s to R2).
- Money/units/attribution: none.

## Non-functional
- Auth: the serve endpoint is public by design (images). Only brand media assets reachable.
- Failure: missing asset → 404. Re-sign failure surfaces as the existing error.
- Gate: `pnpm qa` green. Backend-only → Rule 1 (approved contract) + Rule 2 (release
  evidence); no mockup/06-diff gate. Render deploy surfaced for founder go.
