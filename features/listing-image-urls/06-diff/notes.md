# Before / after — Listing Image URLs

**Before:** product images could only be added by uploading a file from the
desktop — in the stepper and (via the post-import tray) for Excel. A brand
whose images were already hosted (website, supplier, Drive) had to download +
re-upload, and a spreadsheet couldn't carry images at all.

**After (per 04-preview/mockups/image-urls.html, founder-locked):** images can
also be added by **pasting a URL**, on both surfaces:
- **Stepper** — Step ① (cover) and each colour card in Step ② gain a
  "**Paste image URL(s)**" box beside the desktop upload. Each URL is ingested
  and appears as a normal thumbnail (first cover = main). Uploaded + URL images
  mix freely.
- **Excel** — the template gains **Cover image URLs** + **Colour image URLs**
  columns (auto-emitted for every leaf). On import each link is ingested;
  failures are **non-blocking** — the product is still created and the bad link
  is returned in `image_warnings` → shown in the photo tray.

**Ingest, not hotlink:** a pasted URL is **fetched once and copied into our R2**
(`brand_media_assets` → `/v1/media/assets/:id`), identical to a desktop upload,
so a source link that later rots can't break the listing. This mirrors the
codebase's existing IG-cache decision.

**Security (the new surface):** server-side fetch of brand-supplied URLs is
SSRF-hardened — http/https only, DNS-resolve + reject private/loopback/
link-local/CGNAT/multicast (v4, v6, v4-mapped), re-validate every redirect hop,
require `image/*`, 5 MB + 15 s caps.

**Unchanged:** `batchCreate`/`insertProducts`, `validateItem`, the stepper/Excel
flows. No DB/schema/migration; `brand_media_assets` + `/media/assets` serving
reused as-is.

**Verification:**
- `scripts/test-image-ingest.js` **28/28** — SSRF block/allow matrix + scheme +
  literal-IP + localhost rejection.
- `scripts/test-listing-bulk.js` **17/17** — incl. image-URL columns parsed +
  cover/colour links collected per the row-per-variant model.
- Live: template (real leaf) carries both image columns; `POST
  /listing/ingest-image` unauth → 401.
- `next build` compiled (page 8.98 kB); `pnpm qa` **79/79 GREEN**.

**Capture note:** before = the locked mockup; after = founder walk (paste a URL
in the stepper; an Excel import with image-URL columns) — the release gate. The
SSRF + round-trip suites are the automated proof.
