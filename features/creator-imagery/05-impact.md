# Impact — Asset Pack / Per-context Creator Imagery (Phase 7)

**Verdict (one line): the highest-nuance phase (touches how EVERY product image resolves) — but fully flag-gated (default off), so zero change to any store until a brand opts in. Additive: two new tables + one nullable column + a central resolver + upload/approval API + two UIs.**

## Mechanics
- **DB:** new `creator_assets` + `creator_product_images` (migration ≥136) + `brand_products.display_image_source_influencer_id` nullable column (≥137). Additive/idempotent; all existing product rows keep NULL (own image).
- **Backend:** new `creatorImagery.service.js` with the central **`resolveProductImage(product, context)`** (flag `CREATOR_IMAGERY`, default off → returns `product.image_url` — today's exact behavior). Upload + approval controllers/routes. `experience.service` upgraded to build packs from approved shots. **The delicate bit:** any store/render surface that shows a product image must route through the resolver — but with the flag off the resolver is a pass-through, so the swap is inert until deliberately enabled per brand.
- **Web/Mobile (7b):** creator upload UI (influencer app), brand approval + image-source UI (brand-web/brand app), store render via the resolver. UI/mobile-governed.
- **Money/attribution:** none.

## Risk
- **Highest blast radius conceptually** (product images are everywhere) — mitigated by: (1) the flag defaults off; (2) the resolver is a strict pass-through when off; (3) roll out per-brand; (4) approval-gated (no unapproved shot ever shows); (5) resolver never throws → brand-image fallback.
- Performance: product-image resolution runs per product per surface — MUST be memoized/cached (the P4 N+1 note). Batch-resolve where a list renders.
- Lifecycle correctness: collaboration-end takedown must reliably fall a product back to the brand image (workflow-locked; tested).
- Worst case with flag off: literally nothing changes. Worst case with flag on for one brand: that brand's store shows an approved creator shot — the intended behavior.

## Dependencies
- Live P1-6. Upgrades P6's `featured_image_url`. Reuses existing R2 upload infra + the deliverable-approval pattern.

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- 7a (backend): **production-impacting** but **flag-off inert** → explicit go; ships dark.
- 7b (mobile/web): **production-impacting** (OTA + Vercel) + gated → explicit go; mobile `released=false` (batched).
