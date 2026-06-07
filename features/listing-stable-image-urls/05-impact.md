# Impact — Stable image URLs

## Terse verdict
**Backend-only foundation fix; repairs a latent platform bug** (uploaded images dying after
1h). No frontend change, no migration. Unblocks the seller "upload your own photo" flow we
shipped + the upcoming admin stock-image upload.

## Mechanics / blast radius
- `download_url` returned by the gallery becomes a stable redirect URL. Every consumer that
  displays it (gallery UI, campaign pickers, stored `image_url`) keeps working — the URL
  302s to the image. The only behavioural change is permanence.
- New PUBLIC route. Safe: only `brand_media_assets` rows are reachable by id; their keys are
  always `brands/<id>/assets/...`. Contracts/KYC are not media assets → not reachable.
- `RENDER_EXTERNAL_URL` is provided by Render in prod; localhost fallback for dev.

## Risk / rollback
- A media-asset test may assert the old signed `download_url` (contains `X-Amz`/R2 host).
  That is now intentionally a stable app URL → reclassify as business-rule drift + align the
  test (no fake-green). Revert restores prior behaviour.
- Already-stored signed URLs (if any in prod) stay broken until re-saved; none expected (the
  founder's dishes use seeded stock URLs). No backfill in scope.

## Follow-up (separate)
- Admin master-dish stock-image upload UI (brand-web) now lands a permanent URL — build next.
