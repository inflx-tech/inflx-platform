# Workflow Prediction — Admin stock-image upload

Mockup: `mockups/01-admin-stock-upload.html`.

- Admin edits a master dish → "Stock image" field shows a preview + "⬆ Upload stock image".
- Upload picks a file → presigned PUT to R2 (stock/ key) → `default_image_url` set to the
  permanent `/v1/media/stock/...` URL → preview updates → Save (PATCH).
- Seller dish picker shows the new stock image; it never expires (re-sign route).
- Paste-URL fallback still present.
