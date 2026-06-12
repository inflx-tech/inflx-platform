# Workflow — Listing Image URLs

## Manual (stepper)
1. Step ① cover: brand either uploads from desktop OR pastes URL(s) into
   "Paste image URL(s)" → each ingested → thumbnails appear (first = main).
2. Step ② per colour: same dual input per colour card.
3. Mixed is fine — uploaded + URL images coexist in one list.

## Excel bulk
1. Template has **Cover image URLs** + **Colour image URLs** columns.
2. Brand pastes links (comma-separated for multiple).
3. On import each URL is ingested to R2. A link that fails (404, not an image,
   blocked, private) is **skipped** — the product is still created — and listed
   in the response `image_warnings` → the photo tray shows "N image links
   couldn't be fetched" so the brand can re-add.

## Safety
- Only http/https; private/loopback/link-local/multicast hosts rejected
  (SSRF); `image/*` required; 5 MB / 15 s caps. Ingest stores under
  `brands/<id>/assets/` and is served via `/v1/media/assets/:id`.

## Edge cases
- Same URL twice → two assets (no dedup v1; harmless).
- Huge image → rejected (too_large) → warning/skip.
- Non-image (HTML page) → rejected (not_image).
