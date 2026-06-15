# Feature Spec — Section Library engine (Phase 3a)

> Phase 3 step 1 of 3 (3a engine → 3b rule-builder UI → 3c placement+render).
> Backend + data only; additive + DORMANT (nothing renders from it until 3c).
> Written and agreed BEFORE code.

## Problem / goal
Today a follower "shelf" can only point at one of ~20 **hardcoded** rule functions in
`sectionRules.service.js`. There is no way for admin to compose a shelf from filters, and
no reusable section object. This blocks the founder's locked Layer-3 architecture
(a section = reusable {name, rule, image}).

**Goal (3a):** the backend foundation for data-driven sections —
1. a **`section_library`** table = reusable section definitions {business, name, image, rule}, and
2. a **data-driven evaluator** that turns a rule (sub-category + tags + price + sort) into
   gated, context-aware SQL over `brand_products`, returning the same item shape the
   section engine already renders.

3a ships the brain only. The admin rule-builder UI is 3b; making a library section render
to followers is 3c. On deploy 3a changes nothing a user sees (dormant, additive).

## Scope
- **In scope (3a):**
  - Migration: `section_library` table (+ indexes). No seed rows required (admin authors in 3b);
    optionally seed 1–2 example sections for our own testing, marked clearly.
  - New `sectionLibrary.service.js`: validate + persist rule definitions; resolve a rule into
    a SQL filter.
  - New data-driven rule `library_products` in the `RULES` registry (sectionRules.service):
    given a rule definition (from the placed section's config) + ctx, return gated products.
  - Reuse the SINGLE taxonomy source (categoryTaxonomy.service) for business→category, and the
    existing visibility gate (approved + pushed_to_store) and context filters (creator/brand/city).
  - **Context stacking (Layer 6 — IN 3a):** the evaluator ANDs the surface context onto the
    section's own rule so the same section yields different results per surface:
      - `ctx.influencer` (creator surface) → intersect with that creator's LIVE-allocated product
        IDs (reuse the 2b allocation mechanism) — "only products this creator promotes".
      - `ctx.categoryKey` (category / creator-category surface) → AND the tile's member businesses
        (lets a generic "{category}" section specialise per page).
      - brand scope → AND that brand's products; city → soft boost; geo → distance sort.
      - visibility gate always applies. Result = section-rule ∩ whose-surface ∩ where ∩ gate.
    (WHICH sections render on WHICH page-type — the Template/slot system that auto-injects this
    context per page — is Phase 4; 3c does a minimal placement to PROVE the stacking end-to-end.)
- **Explicitly out of scope:**
  - Admin rule-builder UI → **3b**. Placement/rendering to followers → **3c**.
  - Brand/creator/offer carousels (Layer-2 "standard widgets") — 3a sections are PRODUCT rules.
  - Product "trending"/bestseller sort — product-level engagement isn't tracked
    (follower_transactions has offer_id, not product_id); deferred to the Phase 7 ranking
    engine. v1 sort = newest / price ↑ / price ↓.
  - Collections (group of sections) → Phase 4. Templates/slots → Phase 4.

## The rule definition (locked filter set 2026-06-15)
Stored as `section_library.rule_json`:
```
{
  "subcategory_node_id": "<category_nodes.id>" | null,   // matches that node + all descendants
  "tags": ["summer","casual"] | [],                       // product must carry ALL listed tags (@>)
  "price_min": <number> | null,
  "price_max": <number> | null,
  "sort": "newest" | "price_asc" | "price_desc"           // default newest
}
```
- **Category** is implied by the section's `business_type` (the tile → brand.category members,
  via categoryTaxonomy). A section belongs to one business (or 'ALL').
- **Sub-category** = a `category_nodes` id; the evaluator matches products whose
  `category_node_id` is that node OR any descendant (recursive CTE on category_nodes.parent_id).
- **Tags** = slugs from the admin tag vocabulary (validated against tag_vocabulary in 3b).

## Surfaces touched
- **App(s):** backend only (`backend/src/**`, `backend/migrations/**`). No web/mobile. No render.
- **Roles:** admin (authors sections, 3b); follower (sees them, 3c). 3a is plumbing.

## Data / contracts
- **Migration `103_section_library.sql`** (+ `scripts/run-103.js`):
  - `section_library (id, business_type, name, image_url, rule_json jsonb, status, created_at, updated_at)`
  - indexes: `(business_type, status)`.
- **New service `sectionLibrary.service.js`:**
  - `listSections({business_type?})`, `getSection(id)`, `createSection(...)`, `updateSection(...)`, `setStatus(...)`
    (CRUD used by 3b; in 3a only list/get/create needed for tests).
  - `resolveRuleSql(ruleJson, ctx)` → `{ where[], params[], orderBy }` fragment for the evaluator.
  - validation: business_type ∈ taxonomy tiles or 'ALL'; price_min ≤ price_max; sort ∈ enum;
    subcategory_node_id (if set) exists; tags are strings.
- **New rule `library_products`** in sectionRules RULES: reads the section's rule_json (passed via
  ctx.config or a new ctx.ruleDef), applies the visibility gate + categoryTaxonomy members +
  recursive sub-category subtree + tags @> + price range + sort, plus existing ctx context
  (creator allocation / brand scope / city boost / geo distance), returns mapListedProductItem[].
- No API endpoint shape change in 3a (the admin CRUD endpoints are added in 3b). No money/attribution change.

## Non-functional
- **Auth/role gates:** the future admin CRUD (3b) = requireAnyAdminRole. 3a adds no public surface.
- **Failure modes:** invalid rule_json → validation error (3b) / evaluator treats missing fields as
  "no filter on that axis"; unknown subcategory_node_id → matches nothing (honest empty, never "all");
  empty result → section hidden (existing engine behavior). DB/taxonomy unreachable → existing fallbacks.
- **Reuse, not reinvent:** same gate (approved + pushed_to_store), same taxonomy source, same item
  mapper + tracking as the existing listing rules. The evaluator is the existing
  productsInCategory rule generalized with sub-category/tags/price/sort.
- **Deploy:** additive migration + new files; DORMANT (no section_config row uses `library_products`
  until 3c). Production-impacting (backend + migration) → explicit founder go; migrate-first.
