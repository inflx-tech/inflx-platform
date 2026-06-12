# Listing Image URLs (manual + Excel)

> Contract slug: `listing-image-urls`. Lets brands add product images by
> **pasting a URL** (in addition to desktop upload) — in the stepper AND the
> Excel bulk flow — for cover (main + other) and per-colour images. Founder
> direction 2026-06-12. Decisions: **ingest into our R2** (not reference);
> **bad URL in bulk = non-blocking** (create product, skip image, flag in
> tray). See [[project-listing-add-redesign]].

## Why ingest (not hotlink)
External image URLs decay (signed CDN expiry, deletion) and many hosts block
cross-origin `<img>` (Instagram etc.). The codebase ALREADY caches IG images
to R2 for exactly this reason (`imageProxy.service`). So a pasted URL is
**fetched once and stored in our R2**, served via the same stable
`/v1/media/assets/:id` URL as a desktop upload.

## Backend
### SSRF-safe ingest (new `imageIngest.service.js`)
`ingestImageFromUrl({ brandId, url })`:
1. `assertSafeUrl` — **http/https only**; resolve host and **block private,
   loopback, link-local, unique-local, multicast** IPs (v4 + v6, incl.
   v4-mapped); reject otherwise. (Brands paste arbitrary URLs — this is the
   trust boundary the IG path never had.)
2. Download with 15 s timeout + 5 MB cap (reuse imageProxy's fetch shape);
   require an **`image/*`** content-type.
3. `storage.putBuffer(key, buf, contentType)` at
   `brands/<brandId>/assets/listing-<rand>.<ext>`.
4. Insert a `brand_media_assets` row (same table desktop uploads use).
5. Return `${PUBLIC_BASE}/v1/media/assets/<id>` — a stable, brand-scoped URL.

### Endpoint (manual flow)
`POST /listing/ingest-image` (brand auth) `{ url }` → `{ url }` or a typed
error (`bad_scheme` / `private_ip` / `not_image` / `unreachable` / `too_large`).

## Excel (template + import)
- Template gains **Cover image URLs** (product-level, comma-separated; first =
  main) and **Colour image URLs** (on each colour row → that colour's images).
  Auto-emitted from the column model (so they appear for every leaf).
- Import ingests each URL cell. **Non-blocking**: a URL that fails is skipped,
  the product is still created, and the failure is returned as an
  `image_warnings[]` entry → shown in the photo tray. (Spec/data errors stay
  all-or-nothing; images are recoverable.)

## Brand-web (stepper)
- Step ① (cover) and Step ② (per-colour) each get a **"Paste image URL(s)"**
  field beside the desktop file input. Paste one/many → `ingest-image` per URL
  → returned URLs appended to the same image list (identical thumbnails).

## Non-goals
- Re-fetching/refreshing images later (one-time ingest at add).
- URL images for non-listing surfaces.
- Reference (hotlink) mode — rejected (link rot).

## Verification
SSRF unit test (private/loopback/link-local/scheme blocked; image/* enforced);
round-trip extends `test-listing-bulk` (image-URL columns parse + group; bad
URL → warning, product still built); `next build`; `pnpm qa` GREEN.
