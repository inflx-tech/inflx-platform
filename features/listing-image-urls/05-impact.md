# Impact — Listing Image URLs

**Chat verdict (terse):** additive image-input method on both surfaces. New
backend capability = **outbound fetch of brand-supplied URLs** → the one real
risk, mitigated by SSRF hardening. Reuses the existing R2 store + the
`/media/assets/:id` serving path; imported/uploaded/URL images are
indistinguishable downstream. No DB/schema/migration.

## Surface area
- **Backend** — new `imageIngest.service.js` (SSRF + download + asset create);
  `storage.putBuffer` (generalize existing); `POST /listing/ingest-image`;
  image-URL columns + ingest in `listingBulk` + import. Render.
- **Brand-web** — paste-URL inputs in the stepper (cover + per-colour); the
  template columns auto-appear. Vercel.

## Risk
- **SSRF is the headline** — server fetches arbitrary brand URLs. Mitigated:
  scheme allow-list, DNS-resolve + private/loopback/link-local/multicast block
  (v4+v6+v4-mapped), `image/*` enforce, 5 MB + 15 s caps. Unit-tested.
- Otherwise low: reuses proven store + serve; bad URLs are non-blocking in
  bulk, typed errors in manual.

## Backout
- Remove the endpoint + paste inputs + the two columns; revert. Ingested
  assets are ordinary `brand_media_assets` rows (harmless if left).
