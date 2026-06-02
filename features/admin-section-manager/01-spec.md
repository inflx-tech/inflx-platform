# Feature Spec — Admin Section Manager (Phase B)

> Phase B of the Creator Vibe section-engine program. Depends on Phase A
> (`features/follower-section-engine/`, live 2026-06-02 — `section_config` +
> feed endpoints). Lets admins curate the shelves the follower app renders.
> Design LOCKED: the admin panels in `home-comprehensive.html` /
> `category-comprehensive.html` (SECTION-CATALOG.md, 2026-06-01).

## Problem / goal
`section_config` is seeded with global defaults but nobody can edit it without
SQL. Phase B gives admins a **Section Manager** to reorder / show-hide / set
count / pick category+item-type / pin per shelf, per screen, per scope, and
**publish** (instant, no app update — the engine reads `section_config` live).

## Scope
- **In scope (Phase B):**
  - Backend admin endpoints (admin-only, `requireAnyAdminRole`):
    - `GET /v1/admin/sections/:screen?scope_type=&scope_value=` — the shelves for
      a screen+scope (for editing).
    - `PUT /v1/admin/sections/:screen` — upsert/save the shelves (publish). Busts
      the engine cache so changes show within the short TTL.
    - `DELETE /v1/admin/sections/:id` — remove a shelf.
  - admin-web **Section Manager** page (`/dashboard/sections`): screen tabs
    (Home/Category/Offers/Creator Store/Creator's Category) · scope selector
    (global; city/vertical ready) · per-shelf toggle / count (− N +) / reorder
    (up-down) / category + item-type dropdowns on "Top in" rails · Publish.
  - `sectionApi` in `admin-web/lib/api.js`.
  - API tests for the admin endpoints (auth gate, get, upsert, delete, cache-bust).
- **Out of scope (later):** drag-and-drop polish (reorder is up/down in v1) ·
  add-arbitrary-shelf wizard (v1 edits the seeded set + delete) · per-city/vertical
  override authoring UI beyond the scope selector plumbing · Phase C2 screens.

## Surfaces touched
- Backend: `backend/src/controllers/adminSections.controller.js`,
  `backend/src/routes/adminSections.routes.js`, one mount line in
  `routes/index.js`. Production-impacting (Render).
- admin-web: `Packages/admin-web/app/dashboard/sections/page.js`,
  `Packages/admin-web/lib/api.js`. Production-impacting (Vercel on push).
- No mobile, no migration (Phase A table reused).

## Data / contracts
- Reads/writes `section_config` (Phase A). No schema change.
- `GET` returns rows for `(screen, scope_type, scope_value)` ordered by `position`.
- `PUT` body: `{ scope_type, scope_value, shelves:[{ id?, shelf_key, title,
  shelf_type, rule, item_type, category_key, item_limit, position, enabled,
  pinned_ref, config_json }] }` — upsert each by `id` (update) or the
  `uniq_section_instance` identity (insert/update); set `updated_at=now()`.
- Auth: `requireAnyAdminRole` (founder's daily account isn't always superadmin).
- Envelope `{success,data}`; errors VALIDATION_ERROR / NOT_FOUND / FORBIDDEN.

## Non-functional
- **Publish = instant:** PUT clears the engine's in-process cache on the handling
  instance; other instances converge within the short TTL (≤60s). Documented.
- **Validation:** screen ∈ allowed set; shelf_type/rule/item_type within the
  catalog's allowed values (DB CHECKs are the backstop); item_limit 0–50;
  position ≥ 0. Reject unknown screen → NOT_FOUND.
- **Safety:** PUT is upsert-only (never implicit-deletes a shelf the client
  omitted); removal is the explicit DELETE. Editing global defaults is the MVP;
  city/vertical scope is supported by the same endpoints.
- **Failure modes:** partial save → wrap the upserts in a transaction (all-or-
  nothing); unknown id on DELETE → NOT_FOUND.
