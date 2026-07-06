# Workflow — Phase 0 section correctness

## W1 — Business page offers are brand-scoped (A1)
1. Brand A and Brand B both have live offers (any channel).
2. Follower opens Brand A's business page (`GET /v1/follower/business/:brand_id/sections`).
3. Every offer item in every offers-type section has `brand.id === Brand A`.
4. Home deals shelf (`GET /v1/follower/home` etc.) is unchanged — still the
   global pool (no `brandId` in ctx → unscoped).

## W2 — Un-pushing a product pulls it from creator surfaces (A2)
1. Brand pushes product P, allocates it to creator X (campaign/offer).
2. Creator X's store (`/section/creator/:handle`, `resolveStore`) shows P.
3. Brand un-pushes P (`pushed_to_store = false`).
4. Creator X's store, the creator's own preview, and any creator-scoped
   `library_products` shelf no longer return P. Re-pushing restores it
   (allocation itself is untouched).

## W3 — "Category browser" is completable (B1)
1. Admin picks On tap → Category browser (wizard step 4, inline editor, or a tile).
2. A world select AND a category-node select render; node list loads for the
   picked world (fashion/furniture; other worlds show a "no category tree" hint).
3. Changing the world clears the previously picked node.
4. Finishing the wizard / Publishing with type=category and no node is blocked
   client-side with a plain message; with a node picked, Publish succeeds (no 422).

## W4 — Schedule guardrail (B2)
1. Admin sets "Disappears" in the past → red warning inline; wizard finish
   is blocked with the same message. Publish of existing rows stays allowed
   (cleanup flows) — warning only.
2. Admin sets "Disappears" < 6 h away → amber heads-up inline (not blocking).
3. Blank "Disappears" stays the documented always-on default.
