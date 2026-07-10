# Feature Spec — Asset Pack / Per-context Creator Imagery (Creator Experience Engine · Phase 7)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/01_DATA_MODEL.md §E`. The last green-field piece. Builds on live Phases 1-6.

## Problem / goal
The founder's "main thing": a product's image should differ **by context**. A creator shoots real photos *with* the products; the brand approves them; then —
- a **creator's own storefront** shows **only that creator's** approved shots,
- the **brand's own store** shows the brand's **choice** (its own catalog image, or creator X's shot, or creator Y's),
- **one shoot fuels many experiences** (a reusable Asset Bank).
This upgrades Phase-6's single `featured_image_url` into a multi-image, aspect-aware **Asset Pack** that the Adaptive Renderer already knows how to consume. **Shipped behind a flag, default off** — today's single-image behavior is untouched until a brand opts in.

## The 7a / 7b split (RECOMMENDED — confirm at build)
- **7a — data + resolver + asset-pack upgrade (web/API-verifiable NOW):**
  - `creator_assets` (creator-level Asset Bank) + `creator_product_images` (an approved shot bound to a product) tables; `brand_products.display_image_source_influencer_id` column.
  - Central **`resolveProductImage(product, context)`** — the ONE place that decides which image shows (brand-choice / creator-own / fallback). Flag-gated.
  - Creator upload API (register asset, tag to a product) + brand approval API (approve/reject a creator's shot; set a product's display source).
  - Upgrade `experience.service.resolveForTemplate` so a published experience's pack carries the creator's **approved shots** (multi-image, aspect-tagged) instead of one URL.
  - Verify: unit + local DB (upload→approve→resolve per context; asset pack built).
- **7b — upload + approval + store render (mobile/web-governed):**
  - Creator upload UI (tag a shot to a product) in the influencer app.
  - Brand approval + "whose photos show" UI (brand-web admin or brand app).
  - Creator storefront + brand store render via the resolver.
  - jest/web now; Maestro batched.

Recommendation: build **7a first** (the model + resolver + pack upgrade, fully verifiable), then **7b** (the surfaces).

## Scope
- **In scope:** the imagery tables + column; the flag-gated resolver; upload + approval API; the asset-pack upgrade; the creator/brand image UIs (7b).
- **Out of scope:** video assets (images first); AI/auto background generation (Phase 1 decision — curated only); anything already shipped (P1-6).

## Surfaces touched
- Backend (tables + resolver + API), influencer mobile (upload), brand-web/brand mobile (approve + choose), follower render.
- Roles: influencer (upload own shots), brand (approve + choose display source), follower (sees resolved image).

## Data / contracts
- **New tables** (per `01_DATA_MODEL.md §E`): `creator_assets` (influencer_id, campaign_influencer_id?, deliverable_id?, r2_key, media_type, aspect[landscape/portrait/square], status[pending/approved/rejected], approved_by, approved_at) + `creator_product_images` (influencer_id, product_id, asset_id, status, approved_at).
- **Extend:** `brand_products.display_image_source_influencer_id uuid NULL` — NULL = brand's own image (today's behavior); set = show this creator's approved shot in the brand store.
- **Central resolver** `resolveProductImage(product, { context: 'brand'|'creator', influencerId? })` → the image URL. Flag `CREATOR_IMAGERY` (default off) → returns `brand_products.image_url` unchanged until a brand opts in.
- **Asset pack:** an experience's pack.featured_images = the creator's approved shots for that experience's products (aspect-tagged), enabling the renderer's per-layout aspect pick with real photos.
- **New endpoints:** creator upload (`POST /influencers/me/assets` + `/assets/:id/tag-product`), brand approval (`GET/POST /brands/me/creator-images…` approve/reject + `PATCH /brands/me/products/:id/image-source`).

## Non-functional
- **Flag-gated, default off** — zero change to any store until a brand opts in.
- Approval rigor mirrors deliverables (brand approves before a creator shot ever shows).
- **Lifecycle:** define what happens to a creator's shot when a collaboration ends (takedown) — locked in workflow.
- Central resolver must be cached (per the P4 N+1 note) — one resolve per product per context, memoized.
- Mobile/web-governed: `released=true` needs the relevant gates; mobile pushed `released=false` (batched) per pattern.

## Functional outcome
Rahul shoots Street Style photos with 4 products → uploads + tags them → the brand approves. On Rahul's storefront, those products show **Rahul's** photos. In the brand's own store, the brand chooses per product whether to show its catalog image or Rahul's (or Komal's) shot. Rahul's Street Style experience now renders with his real photography, aspect-picked per layout.
