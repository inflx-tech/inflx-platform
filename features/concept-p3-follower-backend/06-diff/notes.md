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

## Hotfix (first-post live test, 2026-07-24)
Feed + detail 500'd on the real post: queries selected i.profile_pic_url —
a column that exists on the marketing creator_profiles table, NOT on
influencers (whose avatar column is profile_image_url). A verify-twice miss,
caught only when a real post existed. Fixed both queries; verified against
prod: feed returns the Monsoon T-Shirt post w/ 3 pins, detail returns all 3
products concept_eligible=true. The app's empty-state masking an API error
is noted for a Stage-C error-state pass.
