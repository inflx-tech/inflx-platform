# Before / After — Per-context Creator Imagery (Phase 7)

## 7a (built, backend — web/API-verifiable) — this pass
**Before:** every product shows one brand-owned `image_url` everywhere.
**After:** a flag-gated per-context resolver + the imagery model + approval API.

### End-to-end proof (local DB)
- **FLAG OFF** (default): `resolveProductImage` returns `product.image_url` for
  BOTH brand + creator contexts → identical to today.
- **FLAG ON**: creator uploads asset → tags product → appears in the brand's
  approval queue → brand approves → 
  - creator store context → returns the creator's approved shot (`/media/creator-asset/…`);
  - brand store context with the creator chosen but NOT in an active collab →
    **auto-withdraws** to the brand's own image (locked takedown rule);
- Full `pnpm qa` 95/95 green — the section engine + every existing surface unchanged.
- Fixed during verify: none (a test-only null `.includes` on a dev product with a null image; resolver returned the correct fallback).

### What matches the intent (the founder's "main thing")
- Tables `creator_assets` (Asset Bank) + `creator_product_images` (approved shot per product); `brand_products.display_image_source_influencer_id` column.
- Central `resolveProductImage(product, context)` — the ONE place; flag `CREATOR_IMAGERY` (default off = strict pass-through).
- Creator upload/tag API + brand approval + "whose photo shows" (`image-source`) API.
- Experience pack upgraded to the creator's aspect-tagged shots when enabled.
- Collab-end takedown = still-contracted check in the brand-context resolver (no cron).

## 7b (next) — mobile/web
Creator upload UI (influencer app) + brand approval / image-choice UI (brand-web/brand app)
+ creator store & brand store render via the resolver. jest/web now, Maestro batched.

## Ships dark
`CREATOR_IMAGERY` defaults off → every store is byte-for-byte unchanged after deploy.
Enabled per brand, deliberately, once 7b's UIs exist.
