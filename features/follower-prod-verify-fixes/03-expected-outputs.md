# 03 — Expected Outputs: prod-verify fixes

- PDP (plain tap) fetches full product; renders: image carousel + dots (when >1 image),
  Product Details spec list from `facets` + section + return policy, description.
- Fashion/furniture PDP shows ONE CTA: Add to Cart (no Pay-at-Store).
- Saving a delivery address works after the 15-min token TTL (silent refresh) — no
  "session expired".
- `GET /follower/products/:id` returns the full product (404 if not active/found).
- `pnpm qa` 79/79 GREEN gate 0; backend node --check clean; OTA bundle compiles.
