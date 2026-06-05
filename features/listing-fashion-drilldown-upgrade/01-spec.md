# Feature Spec — Fashion drill-down upgrade

> Order: 5 of 6 · Depends on: #2 (drilldown-taxonomy-engine) · Status: STUB (draft, not locked). 0 live products → low risk.

## Problem / goal
Fashion currently ships as **variant-matrix only** (size×color SKU grid) with a flat schema and **no drill-down tree** — not the LOCKED fashion model ([[project_listing_fashion_model]]). With 0 live fashion products in prod, upgrade it to the full **drill-once-batch-add tree + per-leaf facets + size variant** on engine #2. Role: **brand** (fashion seller).

## Scope
- In scope: seed fashion `category_nodes` (Gender → category → leaf, variable depth) + per-leaf `facet_definitions`; size as the variant axis (multi-select + per-size stock, reuse `product_variants`); Showcase vs Sell modes (walk-in vs online) + CTA; register/upgrade fashion template; migrate/retire the old `variant_matrix`-only path.
- Explicitly out of scope: engine code (#2), footwear/jewellery (in #6), AI vision (deferred future accelerator).

## Surfaces touched
- App(s): backend (fashion tree/facet seed + schema update); brand-web (replace variant-matrix step with drill-down + facet step).
- Roles involved: brand approved.

## Data / contracts
- New/changed: seed rows in `category_nodes`/`facet_definitions` (vertical='fashion'); `fashion.json` updated; no new tables.
- Endpoints: reuses #2.
- Money/units: price rupees; per-size stock.

## Non-functional
- Auth/role gates: brand approved.
- Failure modes: required facets = color + size; free-size items skip variant; back-compat for any future imported fashion rows; plus-size decision (segment vs facet) resolved at lock.
