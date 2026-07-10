# Feature Spec — Theme Library + Configuration wizard + Blueprints (Creator Experience Engine · Phase 2)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/` (data model §B). Builds on Phase 1 (`design_presets` now live in prod).

## Problem / goal
A **Theme** is a *business definition*, not a title — it carries shopping logic (categories, product counts), media rules, offer eligibility, default copy, and a visual identity (a Phase-1 preset). Admin authors themes as a **curator**, starting from a **Blueprint** and editing only the delta, so the 50th theme takes minutes. This phase adds the Theme Library store + a create/edit **Configuration wizard** + seeded Blueprints. Themes become platform masters that the creator's Experience Studio (Phase 6) will offer.

## Scope
- **In scope:** `experience_themes` table (migration ≥129, additive); seeded **Blueprints** (migration ≥130, `is_blueprint=true` rows); admin CRUD API (list / get / create-from-blueprint / update / publish / list-blueprints); brand-web **Theme Library** list screen + **Theme Configuration wizard**.
- **Out of scope:** Experience Templates (Phase 3/5 combine theme+design+style), the renderer (Phase 4), creator-facing theme selection (Phase 6), editing design tokens/presets (Phase 1, done). The wizard *references* a preset; it does not create presets.

## Surfaces touched
- Apps: backend, brand-web (admin). No mobile, no follower.
- Roles: admin only, `requireCapability('sections')` (same engine-authoring surface as Phase 1 / App Builder / World Rules).

## Data / contracts
- **New table:** `experience_themes` — shape per `01_DATA_MODEL.md §B` (world_key, key, name, subtitle, icon, description, purpose, audience, `preset_key`→design_presets, `supported_categories` jsonb, min/max products, `media_rules_json`, `supported_offer_types` text[], `suggested_product_ids` jsonb, default_title/subtitle/cta, applicable_worlds text[], `is_blueprint`, `blueprint_source_key`, status).
- **Seed:** ~20 Blueprints grouped by purpose (Lifestyle/Occasion/Travel/Budget/Category/Trend) per `03_TOKEN_CATALOG.md §7`, each pre-filling preset + categories + media rules + offers + copy.
- **New endpoints (admin, `requireCapability('sections')`):**
  - `GET  /v1/admin/themes?world_key=&status=` → list authored themes.
  - `GET  /v1/admin/themes/blueprints?world_key=` → list blueprints (starting points).
  - `GET  /v1/admin/themes/:id` → one theme.
  - `POST /v1/admin/themes` → create (optionally `from_blueprint_key` clones its fields).
  - `PATCH /v1/admin/themes/:id` → update fields.
  - `POST /v1/admin/themes/:id/publish` → status draft→published (validates required fields).
- **Reference data the wizard reads (existing):** presets (`GET /admin/design-system/presets`, Phase 1), world categories (`GET /admin/follower-categories` / listing taxonomy), offer types (static: discount/volume/bogo/bundle/free_gift).
- Money/attribution/status machines affected: none.

## Non-functional
- Auth/role gate: `requireCapability('sections')`. Default deny.
- **Publish validation** (server): name, preset_key, ≥1 supported category, min≤max, required default copy present, and if `media_rules.featured='required'` it's recorded — else 422 with field. This is where the Theme's own rules get enforced (closes the old "sections placed empty" gap).
- Failure modes: unknown blueprint key on create → 422; unknown world → empty list, 200; editing a published theme allowed (stays published) — no versioning in v1.
- Deploy-inert until migrated + seeded; additive — zero impact on existing screens.

## Functional outcome
As admin: open **Fashion World → Theme Library** → **Create Theme** → pick the **Street Style** blueprint → the wizard is pre-filled (preset Urban Fashion, categories, media rules, offers, copy) → edit the delta → **Publish**. "Street Style" is now a platform master. Adding "Airport Looks" = duplicate a blueprint, change purpose→Travel + categories + background + subtitle → save.
