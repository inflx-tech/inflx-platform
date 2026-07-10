# Feature Spec — Experience Templates + Home Builder placement (Creator Experience Engine · Phase 5)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/01_DATA_MODEL.md §C` + decision D2 (templates write `section_config`). Builds on live Phases 1-3 (presets/themes/layouts) + 4 (renderer).

## Problem / goal
The **Experience Template** is where admin *assembles* the reusable parts into a placeable unit: **Template = Theme (P2) + Design layout (P3) + Section Style**, plus its **placement** (which screens/scopes), **store rules**, **creator-store rule**, and **location priority**. Placing a template writes a `section_config` row so it flows through the *existing, mature* section engine — inheriting scheduling, location, and hide-empty for free. A placed template renders **empty until creators publish experiences** (Phase 6), so the live follower home is unchanged until then.

## Scope
- **In scope:** `experience_templates` table (migration ≥133); `section_config.template_id` column (≥134, nullable, additive); a new **`experience_template`** rule in the section engine that resolves creator experiences for a template — **returns empty in Phase 5** (no experiences yet), so hide-empty drops it; admin CRUD + a "place" action that upserts a `section_config` row; brand-web **Experience Templates** list + builder screens.
- **Out of scope:** creator experiences that fill the template (Phase 6), the Asset Pack imagery (Phase 7), automatic/mixed section *data* resolution (Phase 9), the mobile follower render of a live template (needs Phase 6 data).

## Surfaces touched
- Apps: backend (incl. one additive rule in the section engine), brand-web (admin). No mobile change.
- Roles: admin only, `requireCapability('sections')`.

## Data / contracts
- **New table:** `experience_templates` — per `01_DATA_MODEL.md §C` (world_key, key, name, template_type[creator|automatic|mixed], theme_key→experience_themes, design_layout_key→design_layouts, section_style enum, placement_json, store_rule, creator_store_rule, location_priority, status).
- **Extend:** `ALTER TABLE section_config ADD COLUMN template_id uuid NULL REFERENCES experience_templates(id)`. Existing rows/columns untouched.
- **New rule key `experience_template`** in `sectionRules.service` → resolves experiences for the row's `template_id`; **Phase 5 returns `[]`** (graceful; the section hides). This is the ONLY touch to the live engine — additive, no existing rule changed.
- **New endpoints (admin, `requireCapability('sections')`):**
  - `GET /v1/admin/experience-templates?world_key=&status=`
  - `GET /v1/admin/experience-templates/:id`
  - `POST /v1/admin/experience-templates` (create; validates theme+layout exist)
  - `PATCH /v1/admin/experience-templates/:id`
  - `POST /v1/admin/experience-templates/:id/place` (upsert a `section_config` row from placement_json; returns the section row)
  - `POST /v1/admin/experience-templates/:id/unplace` (disable/remove the section row)
- **Reference data (existing, read-only):** themes (`/admin/themes`), layouts (`/admin/design-layouts`), section styles (`/admin/section-styles`).

## Non-functional
- Auth: `requireCapability('sections')`. Default deny.
- **Publish/place validation:** template must have a theme + layout + section_style; placement must name a valid screen/scope. Placing writes an `enabled=true` section_config row whose rule returns empty until Phase 6 → **honest hidden**, no broken UI.
- Failure modes: unknown theme/layout on create → 422; place with bad screen → 422; the new rule never throws on empty.
- **Live-engine safety:** the `experience_template` rule is new and isolated; every existing rule + section is unchanged; a placed template is invisible to followers until creators fill it. Zero change to the current live home in Phase 5.

## Functional outcome
As admin: open **Fashion World → Experience Templates → Create** → pick type **Creator** → Theme **Street Style** + Design **Hero Banner** + Section Style **Hero** → name auto-suggests "Street Style Hero" → set placement (Fashion Home), store rule (if-products), creator-store rule (if-creator-has-experience), location (city→…→global) → **Place**. A `section_config` row now exists; the follower home is unchanged (empty → hidden) until creators publish experiences in Phase 6.
