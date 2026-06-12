# Expected outputs — Listing Image URLs

## Backend
- `POST /listing/ingest-image` (brand auth) `{url}` → 201 `{url:
  ".../v1/media/assets/<id>"}`; 422 typed message on bad scheme / private IP /
  not image / unreachable / too large; unauth → 401.
- Import response gains `image_warnings[]` (`{name, where, url, reason}`) for
  links that couldn't be fetched (product still created).
- Template: `Cover image URLs` + `Colour image URLs` columns present on every
  leaf.

## Brand-web (`/dashboard/products/listing`)
- Stepper Step ① cover + Step ② per-colour: a "Paste image URL(s)" input +
  "Add URL" button beside the desktop upload; ingested URLs become thumbnails.

## Invariants
- Ingested image = a `brand_media_assets` row under `brands/<id>/assets/`,
  served at `/v1/media/assets/:id` — identical to a desktop upload.
- SSRF guard blocks private/loopback/link-local/CGNAT/multicast (v4+v6+mapped),
  bad schemes, and unsafe redirect targets; enforces image/* + 5 MB + 15 s.
- Bulk image failures are non-blocking; spec/data errors stay all-or-nothing.
- No DB/schema/migration; no new deps.

## Proof (recorded)
- `test-image-ingest.js` 28/28; `test-listing-bulk.js` 17/17.
- Live template image columns; ingest unauth 401.
- `next build` compiled (8.98 kB); `pnpm qa` 79/79 GREEN.
