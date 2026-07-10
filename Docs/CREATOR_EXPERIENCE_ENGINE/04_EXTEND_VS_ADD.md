# 04 — Extend vs Add (grounded in current files)

> Confirms the "extend, don't rebuild" posture with real file/table names. Verified against migrations 025, 049, 083 and the four subsystem reads (2026-07-10).

## Reuse — untouched
| Area | Where | Note |
|---|---|---|
| Offer engine (5 types + checkout) | `brandOffer.controller.js`, `offer.service.js`, `offerConfig.validator.js`, `brand_offers` (084) | Themes reference `supported_offer_types`; no offer change until Phase 9 extras. |
| Section engine + rules | `sectionEngine.service.js`, `sectionRules.service.js`, `section_config` (083) | Gains one column + one rule key (below). |
| Location / hide-empty | `world_rule_settings` (126), banner_gateway/hero_tiles gating | Template placement reuses as-is. |
| Deliverable approval + escrow | `deliverable.controller.js`, `deliverables` (001/009) | Feeds the Asset Bank in Phase 7. |
| Creator storefront | `influencerStore.controller.js`, `influencer_store_inventory` (094) | Image resolution swapped in Phase 7 (flagged). |
| Lookbooks | `lookbooks.controller.js`, `creator_lookbooks`/`lookbook_products` (049) | Stay as a lightweight surface; experiences are new (D1). |
| Campaigns / proposals state machine | `campaign.*`, `proposal.controller.js`, `influencer_proposals` (025) | Proposals gain 4 nullable columns in Phase 8. |
| Admin Page Builder / section library | `adminSections.*`, `adminSectionLibrary.*`, `adminPages.*`, `section_library` (103) | Home Builder reused for template placement. |

## Extend — additive only
| Table / file | Change | Phase |
|---|---|---|
| `section_config` | + `template_id uuid NULL`; new rule `'experience_template'` | 5 |
| `brand_products` | + `display_image_source_influencer_id uuid NULL` (NULL = today's behavior) | 7 |
| `influencer_proposals` | + `scope_level`, `scope_ref_json`, `theme_key`, `proposed_product_ids` (all NULL) | 8 |
| `SectionRenderer.js` + `vibe` kit (mobile) | add Adaptive Renderer path (token+contract+pack); existing shelves untouched | 4 |
| brand-web admin | new pages under `Packages/brand-web/app/admin/` (Design System, Themes, Templates) | 1,2,5 |

## Add — new tables
`design_tokens`, `design_presets`, `design_layouts`, `experience_themes`, `experience_templates`, `creator_experiences`, `experience_products`, `creator_assets`, `creator_product_images`, `product_view_events`. All ≥ migration 127, all additive/idempotent.

## New code of substance (the two real builds)
1. **Adaptive Renderer** (Phase 4, mobile) — the token+contract+pack → pixels engine.
2. **Creator-imagery resolver** (Phase 7, backend) — central `resolveProductImage(product, context)`, flagged.

Everything else is seed content, admin CRUD screens, or thin extensions of proven modules.

## Governance notes
- New admin surfaces sit behind the capability model (`feedback_admin_role_gates`).
- Section/theme/template edits go live in ~60s with no staging gate today (known P4 fragility, `project_governance_roadmap`) — Theme/Template writes must be capability-gated; flag prod-impacting edits.
- pnpm-workspace casing caveat (`project_pnpm_workspace_casing`) applies to any new package wiring.
