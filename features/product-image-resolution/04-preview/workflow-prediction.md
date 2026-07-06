# Workflow prediction — product image resolution (backend-only)

- Brand listing browse and follower product cards show a photo whenever the
  product has an image in ANY of image_url / variant colours / cover_images /
  facets — matching what the edit form already showed. No re-save needed.
- Newly created products (any path) get image_url derived when a variant image
  exists, so they never start blank.
- No admin UI change; no mobile change (follower reads the resolved image_url).
- Deploy day in prod: no visible change (0 broken rows); the fix prevents
  recurrence and repairs staging/new uploads.
