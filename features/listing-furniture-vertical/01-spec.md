# Feature Spec — Furniture vertical (tree + facets)

> Order: 3 of 6 · Depends on: #2 (drilldown-taxonomy-engine) · Status: STUB (draft, not locked). Mostly data.

## Problem / goal
Furniture is a LOCKED model ([[project_listing_furniture_model]]) reusing the drill-down engine, but has **no UI template registered** and **0 live products**. Goal: stand up furniture end-to-end on engine #2 by seeding its tree + per-leaf facets and registering its template. Role: **brand** (furniture seller).

## Scope
- In scope: seed `category_nodes` + `facet_definitions` for furniture from the reviewed CSVs `C:\WORK\furniture_listing_tree.draft.csv` (8 families → ~52 item-type leaves) and `C:\WORK\furniture_facets.draft.csv` (cross-cut + per-leaf); register furniture in `templateRegistry.js`; wire Showcase vs Sell modes + CTA (Visit/WhatsApp/Request-Quote vs Buy/EMI); furniture-specific listing attributes (Dimensions L×W×H, Material/Finish, Made-to-order + lead-time, "starting from" price).
- Explicitly out of scope: engine code (delivered in #2), other verticals.

## Surfaces touched
- App(s): backend (seed migration + furniture schema config); brand-web (template registration, furniture step components/FleetRow).
- Roles involved: brand (approved).

## Data / contracts
- New/changed: seed rows into `category_nodes`/`facet_definitions` (vertical='furniture'); `backend/public/schemas/furniture.json` updated to reference tree+facets + modes; no new tables.
- Endpoints: reuses #2 (`/listing/tree?vertical=furniture`, leaf facets, batch create).
- Money/units: price rupees; supports "starting from" + per-variant (seater/size/doors).

## Non-functional
- Auth/role gates: brand approved.
- Failure modes: made-to-order items skip stock; Showcase items need no size matrix; CSV seed idempotent + reviewable (CSV-first rule).
