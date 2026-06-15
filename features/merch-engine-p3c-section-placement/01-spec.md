# Feature Spec — Section placement (Phase 3c)

> Phase 3 step 3 of 3 (3a engine ✅ → 3b rule-builder UI ✅ → 3c placement).
> The visible payoff: a library section actually renders to followers.
> UI-governed (brand-web admin only). Spec → mockup-lock → implement → 06-diff.

## Problem / goal
3a built the evaluator, 3b lets admin author sections — but nothing renders to followers
yet because no section is *placed* on a screen. **Goal (3c):** let admin place a library
section onto a follower screen, and it renders (proving the engine + context stacking
end-to-end).

Discovery during scoping (verified): this needs **no backend, no mobile, no migration** —
- `saveSections` already persists any `rule` + `config_json` (no rule whitelist),
- the 3a engine already renders a `rule='library_products'` row via `config_json.library_section_id`,
- the mobile `SectionRenderer` already renders `shelf_type='products'` shelves.
So 3c = a small extension of the existing **App Sections** admin page to place a library section.

## Scope
- **In scope:** extend `app/admin/sections/page.js`:
  - Load library sections (`adminApi.listSectionLibrary()`).
  - New add-preset **"Library Section"** → row with `rule='library_products'`,
    `shelf_type='products'`, `item_type='products'`.
  - When a row's `rule==='library_products'`, show a **library-section picker** (dropdown of
    section names by business); selecting one sets `config_json.library_section_id` and the
    row `title` (defaults to the section's name, editable). Existing reorder / position /
    enable / item_limit / screen-scope controls apply unchanged.
  - **Safety guard (backend, defense-in-depth):** `sectionEngine` renders an *unresolved*
    library placement (no/hidden/deleted section) as EMPTY instead of falling through to
    "all gated products". Pairs with the UI publish-block. (Small 2-line guard.)
- **Explicitly out of scope:**
  - Mobile / migration change (none needed — the renderer already handles `products`).
  - Templates/slots system + Collections (group of sections) → **Phase 4**.
  - Banner-gateway / hero-tile presentation types → Phase 6.

## How rendering + context work (already built)
- Admin places "Jeans Under ₹499" on **Home** → engine runs `library_products` at platform
  scope → followers' Home shows a "Jeans Under ₹499" product shelf (gated: approved + pushed).
- Place the SAME section on **Creator Store** → engine injects that creator → the shelf shows
  only that creator's allocated jeans (context stacking, from 3a). One section, two surfaces.

## Surfaces touched
- **App(s):** brand-web admin (App Sections page) only. No backend, no mobile.
- **Roles:** admin places; follower sees the result.

## Data / contracts
- No migration, no new endpoint. Reuses `PUT /admin/sections/:screen` (saveSections) +
  `GET /admin/section-library` (3b) + `GET /admin/sections/:screen`.
- The placement row stored in `section_config`: `rule='library_products'`,
  `shelf_type='products'`, `config_json={ library_section_id }`, `title=<section name>`.

## Non-functional
- **Auth/role gates:** unchanged (admin).
- **Failure modes:** a placement with no `library_section_id` selected → save blocked with a
  hint; a placed section whose library row is later hidden/deleted → engine `getRuleJson`
  returns null → ruleDef null → the shelf renders empty → engine hides it (existing
  empty-section behavior). No crash.
- **Theme:** existing App Sections page styling (unchanged).
- **Deploy:** brand-web (Vercel) only. No backend redeploy needed for behavior, no OTA.
  released=false until founder verifies the follower render.
