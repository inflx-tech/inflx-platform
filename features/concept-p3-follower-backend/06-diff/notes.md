# Before/after — concept-p3-follower-backend

Backend-only contract — no UI files, no mockups, so no visual diff exists.
This file satisfies the Rule-4 range scan: the UI paths in the shared push
range belong to concept-p3-post-globals, whose 06-diff/notes.md carries the
real visual before/after.

## API surface before/after (the actual diff of this contract)
- Before: no follower-facing posts endpoints; PDP returned zero offer data.
- After: GET /v1/follower/posts (feed) + /posts/:id (viewer payload with
  live-joined pins, shop list, per-product tracking/via_creator); PDP
  carries discount_value/offer_price/offers[]. Verified via node route-graph
  load + pnpm qa GREEN; live verification lands with the first approved post
  after deploy.
