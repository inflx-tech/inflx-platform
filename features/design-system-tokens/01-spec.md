# Feature Spec — Design System & Tokens (Creator Experience Engine · Phase 1)

> Contract-driven Step 2. Agreed BEFORE code. Parent spec: `Docs/CREATOR_EXPERIENCE_ENGINE/`.

## Problem / goal
Admin needs a curated visual **vocabulary** — moods, palettes, typography, backgrounds, and preset bundles — to author Themes without designing pixels (curator, not designer). This phase creates the token store + seed catalog + a read-only admin browse screen. No themes/templates/rendering yet.

## Scope
- **In scope:** `design_tokens` + `design_presets` tables (migration ≥127, additive); seed of the Fashion starter catalog (`Docs/.../03_TOKEN_CATALOG.md`); backend read APIs; admin "Design System" browse screen under brand-web.
- **Out of scope:** creating themes (Phase 2), layouts/contracts (Phase 3), rendering (Phase 4), background *asset files* production (tracked as the one-time design workstream — this phase seeds records + placeholder keys), editing tokens from the UI (read-only v1).

## Surfaces touched
- Apps: backend, brand-web (admin). No mobile, no follower.
- Roles: admin only (capability-gated, per `feedback_admin_role_gates`).

## Data / contracts
- **New tables:** `design_tokens(kind,key,label,world_key,config_json,status,sort_order)`, `design_presets(key,label,world_key,tokens_json,positions_json,status)`. Shapes per `01_DATA_MODEL.md §A`.
- **Seed:** moods(8), palettes(6), typography(6), backgrounds(16), radius(3), shadow(3), presets(8) — values per `03_TOKEN_CATALOG.md`.
- **New endpoints (read-only, admin):**
  - `GET /v1/admin/design-system/tokens?world_key=&kind=` → grouped tokens.
  - `GET /v1/admin/design-system/presets?world_key=` → presets with resolved token labels.
- Money/attribution/status machines affected: none.

## Non-functional
- Auth/role gate: `requireCapability` (same pattern as adminSectionLibrary). Default deny.
- Failure modes: empty catalog → returns empty groups (screen shows "nothing seeded yet", not an error). Unknown world_key → empty, 200.
- Deploy-inert until migration is run + seeded; zero impact on existing screens (purely additive).

## Functional outcome
As admin: open **Fashion World → Design System** → see and browse curated Moods / Palettes / Typography / Backgrounds / Presets. The vocabulary the Theme wizard (Phase 2) will consume now exists.
