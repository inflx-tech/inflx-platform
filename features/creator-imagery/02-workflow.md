# Workflow — Asset Pack / Per-context Creator Imagery (Phase 7)

## 7a — data + resolver + asset-pack upgrade (web/API-verifiable)

### Happy path (end state to prove)
1. Creator `POST /influencers/me/assets` (r2_key from the existing upload flow, media_type) → a `creator_assets` row (status pending, aspect auto-detected).
2. Creator tags it to a product `POST /influencers/me/assets/:id/tag-product { product_id }` → a `creator_product_images` row (pending).
3. Brand `POST /brands/me/creator-images/:id/approve` (or reject) → status approved.
4. Brand optionally `PATCH /brands/me/products/:id/image-source { influencer_id }` → the brand store will show that creator's approved shot for the product.
5. **`resolveProductImage`** returns:
   - `context='creator', influencerId=Rahul` → Rahul's approved shot for the product (else brand image).
   - `context='brand'` → the brand's chosen source (Rahul's shot if set + approved; else brand image).
   - flag off → always `brand_products.image_url` (unchanged).
6. `experience.service.resolveForTemplate` builds each experience's pack.featured_images from the creator's approved shots (aspect-tagged).
7. **End state (7a):** proven by unit + local DB — upload→tag→approve→resolve differs by context; the asset pack carries real shots. Flag off → nothing changes.

## 7b — upload + approval + store render (mobile/web-governed)

### Creator (influencer app)
1. In the Studio / a product row → **Add your photo** → upload → tag to the product.
2. My Shots list shows pending/approved status.

### Brand (brand-web admin or brand app)
1. **Creator Images** queue → approve / reject each creator shot.
2. On a product → **Whose photo shows here?** → Own · Creator X · Creator Y.

### Follower
1. Creator storefront → products show that creator's approved shots.
2. Brand store → products show the brand's chosen source.

## Failure / edge states
- Unapproved shot never shows anywhere (only status='approved').
- Flag off → resolver returns the brand image everywhere (today's behavior).
- **Collaboration ends** → the creator's shots are withdrawn from the brand store (brand's display source falls back to own image); the creator's own store no longer surfaces those products. (Locked here.)
- Resolver never throws → missing/blocked → brand image fallback.

## Proof of success
- 7a: unit (resolver per context) + local DB (upload→approve→resolve; pack build); `pnpm qa` green; flag-off = zero change.
- 7b: jest/web for the upload + approval UIs; Maestro batched.
