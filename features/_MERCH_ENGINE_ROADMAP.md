# Merchandising / Follower-Control Engine — Ordered Contract Roadmap

> Deploy-inert planning doc. The admin-controlled followers-app architecture,
> locked with the founder 2026-06-14. Each phase = one or more contracts through
> the standard pipeline; **no implementation until each contract's Step-5 lock**.
> Full architecture + verified file:line baseline live in auto-memory
> `project_listing_section_architecture`.

## The model (one line)
Products → **Tags** → **Sections** (reusable rules) → **Collections** (group
sections) → **Templates** (place sections in slots, one per page-type) →
**Context Filters** (stack creator / brand / city onto the rule) →
**Ranking / Recommendation** (order) → final screen.

- **Visibility gate:** nothing is visible in the followers app until **pushed-to-store**
  OR **allocated-to-creator**. Platform pages = union of pushed ∪ allocated, ranked.
- **Stores:** Brand Store = brand's pushed items; Creator Store = auto from the
  creator's live-campaign allocations (no hand-picking).
- **Palette:** INFLX gold/cream/white; gold = action, cream = feature cards,
  terracotta = sale/discount, serif = hero moments.

## Verified baseline (re-audited 2026-06-14)
- **Reuse (exists):** section engine + context filters + ranking + card components
  + offer publish-to-store.
- **Net-new:** product tags, product push-to-store, Collections, Templates/slots,
  banner-gateway, hero-tiles, recommendation engine, cart/checkout.
- **Refactor:** sections are screen-bound + rules from a fixed code registry;
  follower categories hardcoded; brand store bespoke (not on the engine); creator
  store hand-picked.

## Ordered backlog
| Phase | Contract slug | Scope (one line) | Depends on |
|---|---|---|---|
| 1a | `merch-engine-p1a-product-tags` | product `tags` field + admin tag-vocabulary per business + brand tag-picker | — |
| 1b | `merch-engine-p1b-category-admin` | follower categories → DB + admin management of categories / subcategories / creator-cat / brand-cat | — |
| 2 | `merch-engine-p2-visibility-gate` | product push-to-store flag + creator allocation link + rewrite store/platform/deal queries to pushed ∪ allocated | 1a, 1b |
| 3 | `merch-engine-p3-section-library` | reusable section object {name, rule, image} + visual rule-builder (category + subcat + tags + price + sort) | 1a, 1b |
| 4 | `merch-engine-p4-collections-templates` | Collections (group sections) + Templates/slots per page-type (context-aware default) | 3 |
| 5 | `merch-engine-p5-stores-on-engine` | brand store onto engine (gated) + creator store auto-allocation + context auto-inject | 2, 4 |
| 6 | `merch-engine-p6-presentation` | banner-gateway + rule-results screen + hero-banner-with-tiles | 4 |
| 7 | `merch-engine-p7-recommendation` | personalized for-you / near-you scoring (location + interests + history) as a rule | 3 |
| 8 | `merch-engine-p8-shop-checkout` | cart + checkout (shipping/payment/review) + confirmation + tracking (online-order) + INFLX re-skin | 2, 5 |

## Notes
- Each phase is **independently shippable**; later phases only READ earlier outputs.
- **Context-aware generic templates FIRST**; per-category hand-curated variants = later phase.
- All phases are **production-impacting** (migrations / backend / app) → explicit go
  before deploy, never silent. UI-touching parts need mockup-lock (gov-check Rule 3).
- Program-name `merch-engine` is provisional — rename freely; slugs are cheap to change pre-lock.
