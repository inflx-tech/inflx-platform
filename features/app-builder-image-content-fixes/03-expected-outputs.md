# Expected outputs — app-builder-image-content-fixes

1. `POST /admin/sections/stock-upload-url` (capability `sections`) returns
   `{ upload_url, method, key, public_url }`; registered before `/:screen`.
2. App Builder image upload uses it; errors show in the wizard; "uploading…"
   indicator during transit.
3. Name optional for NAME_HIDDEN_DESIGNS (auto-filled hidden label); required
   otherwise.
4. My-images step shows the design's size/aspect/format guidance.
5. `pnpm qa` GREEN; backend boots; brand-web builds.
