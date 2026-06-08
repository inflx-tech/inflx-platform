# Feature Spec — admin-section-manager-v2

> Founder request (2026-06-08): make the Admin Section Manager control NAMES and
> structure, not just order/visibility. Extends the shipped `admin-section-manager`.

## Problem / goal
The live Admin Section Manager (`/admin/sections`) can reorder, show/hide, set
count, pick category/item-type, and delete — but **cannot** rename shelves, edit
captions / chip / filter labels, add new sections, or scope per city/vertical. The
backend `saveSections` already supports all of these (title, config_json, insert,
scope) — only the UI is missing. Separately, the Home **greeting** and the Category
**sub-cat chips** are not admin-controllable at all.

## Scope
- **Part A (this contract — items 1–4, brand-web only, Vercel):**
  1. **Rename shelf titles** — inline-editable title per shelf.
  2. **Config editor** — caption (`sub`), chip/filter labels, nav-vertical
     labels+icons, and an advanced raw-JSON editor (validated).
  3. **＋ Add Section** — add a new shelf from a preset (brands/products/offers/
     creators/controls); Publish inserts it.
  4. **City / per-vertical scope** — scope selector (Global / City / Vertical);
     load + publish that scope's shelves (overrides).
- **Part B (items 5–6 — separate follow-up, cross-surface):**
  5. Greeting admin-editable (config-driven home `header` shelf + app reads it).
  6. Admin-curated sub-cat chips (config + app reads config-or-derived).
  *(Part B is tracked here but built + shipped after Part A; needs a migration + OTA.)*

- **Explicitly out of scope (Part A):** any backend change (already supports it);
  the greeting/chips app-read plumbing (Part B); mobile.

## Surfaces touched (Part A)
- brand-web: `Packages/brand-web/app/admin/sections/page.js` only. No backend
  change (existing `/v1/admin/sections` list/save/delete already supports title,
  config_json, insert, scope).

## Data / contracts
- Uses existing `sectionApi.getSections(screen, scopeType, scopeValue)` /
  `saveSections(screen, {scope_type, scope_value, shelves})` / `deleteSection(id)`.
  `saveSections` validates shelf_key/title/shelf_type/rule/item_limit(0–50)/
  position; honours `config_json`; inserts when no `id` (ON CONFLICT upsert).
- No migration in Part A.

## Non-functional
- Admin-only (`requireAnyAdminRole`). Publish busts the 60s engine cache → live in
  the follower app within ~60s.
- Backend-first: the editor only writes fields the engine actually reads; raw-JSON
  editor validates before apply (no malformed config saved).
- Vercel auto-deploys brand-web on push; no OTA for Part A.
