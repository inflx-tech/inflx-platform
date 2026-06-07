# Expected Outputs — Admin stock-image upload

- `POST /admin/master-dishes/stock-upload-url` (reviewer) returns `{upload_url, method, key,
  public_url}`; key under `stock/dishes/`.
- `GET /v1/media/stock/*` re-signs + 302s; only `stock/` keys; rejects traversal; 404 unknown.
- Admin master-dishes edit modal has an "⬆ Upload stock image" button + preview; uploading
  sets `default_image_url` to the permanent `public_url`. Paste-URL fallback still works.
- Uploaded stock image renders in the admin table + seller dish picker, and after >1 hour.
- `pnpm qa` GREEN; C1 GREEN; mockup_locked + non-empty 06-diff.
- Release: production-impacting (Render + Vercel); founder go.
