# concept-p1-engine — Phase 1: the concept language (admin)

**Program:** Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md · **Architecture:** POST_CONCEPT_MODEL.md §3/§3.5/§4
**Depends on:** concept-p0-foundation (offer_type + eff_price predicates, leaf allocation)

## Goal (functional)

Admin defines ~47 concept TEMPLATES once; combined with the 195 fashion leaves
they yield ~9,200 addressable CONCEPTS, none stored as rows. Admin can open any
concept and see the live products it catches right now. Plus the admin-curated
COLLECTIONS vocabulary (family 6 — names with no rule). Nothing follower-visible.

## Data model (mig 139)

- `concept_templates` — kind ∈ category|price|offer · template_group
  (seasonal/occasion/style/utility, category kind) · name_pattern ('Winter
  {Category}' / 'Under ₹499' / 'BOGO') · rule teeth: required_tags[],
  eff_price_min/max (EFFECTIVE price — after best live discount), offer_type
  (+ min_discount_pct) · status · sort_order. UNIQUE (kind, name_pattern).
- `concepts` — lazily-materialized (template_id × category_node_id?) identity;
  ships empty; becomes the FK target for creator_posts in P2.
- `collections` — name/slug/status/sort. Seeded with the founder's 14 examples.
- Seeds: 27 category + 9 price + 11 offer templates (founder's lists,
  Follower creator commerce.docx). "Flash Sale"/"Limited Time" from the doc are
  NOT seeded — they are time-window ideas, not offer-type-expressible; needs an
  ends-within rule field if wanted later (flagged to founder).

## Behaviour

- Name generation (never stored): category kind replaces {Category}; price kind
  + leaf → "Jeans Under ₹499" (leaf first); offer kind + leaf → "BOGO Jeans"
  (offer first). Family derived: cat=1, price=2/4, offer=3/5 (leaf present?).
- Rule resolution: concept → section-library rule_json → the EXISTING
  library_products evaluator. Preview truth = render truth = (in P2) the
  composer's picker truth. One evaluator, three surfaces.
- Seasonal/style templates with empty required_tags filter nothing beyond the
  leaf — they are discovery buckets by design (founder lock 2026-07-22).

## Surfaces

- `/admin/concepts` — kind tabs (Category grouped by 4 groups / Price / Offer),
  template CRUD + hide, addressable-concepts counter, per-template PREVIEW
  modal: pick a leaf (optional for price/offer) → generated name + family +
  rule_json + live count + 8-product sample.
- `/admin/collections` — vocabulary CRUD (add/rename/hide).
- Nav: CONTENT → Concepts 💡 + Collections 🧺 above App Builder (cap: sections).
- API: GET/POST/PATCH /admin/concept-templates · POST /admin/concepts/preview ·
  GET/POST/PATCH /admin/collections (requireCapability('sections')).

## Non-goals

Posts (P2) · concept materialization endpoint (P2 does it on first post) ·
follower rendering (P4) · Concept Inspector post-counts (P4 — needs posts).
