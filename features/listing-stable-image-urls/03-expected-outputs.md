# Expected Outputs — Stable image URLs

- `GET /v1/media/assets/:id` exists, public, 302-redirects to a fresh signed R2 URL; 404 on
  unknown id. Only `brand_media_assets` reachable (never contracts/KYC).
- `mediaAsset._enrich` / `createAsset` / `listAssets` return `download_url` as
  `<RENDER_EXTERNAL_URL>/v1/media/assets/<id>` (stable), not a raw signed URL.
- A freshly uploaded image (seller dish photo, brand cover) renders **after >1 hour**.
- Seeded Unsplash stock URLs still render (unchanged path).
- `pnpm qa` GREEN; C1 GREEN.
- Release: production-impacting (Render backend, new public route + changed download_url
  shape), founder go.
