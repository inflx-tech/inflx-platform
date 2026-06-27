# 01 — Spec: admin-category-rail (node-backed category rail)

## Problem
As admin composing the follower app, picking Home → Fashion → "Category rail" today
only auto-fills from a flat table (`follower_vertical_categories`) with **no link to
the catalogue tree** — you cannot pick Men → Bottomwear → Jeans. The locked plan
(`project_follower_build_plan`, the connection-chain) needs: admin drills the
`category_nodes` tree, ticks nodes at any level (NOT individual products), each
becomes a rail tile, and tapping a tile opens the Phase-1 CategoryBrowser at that node.

## Scope
- **Backend rule** `category_nodes` (`sectionRules.service.js`): reads
  `config_json.nodes[]` and emits tiles `{entity_type:'category', key, label, icon,
  category_node_id, vertical}`. Registered in `RULES`.
- **Admin** (`brand-web/app/admin/sections/page.js`): new preset "Category rail (pick
  from catalogue)" (`shelf_type:'nav_tiles', rule:'category_nodes'`); a node picker
  that drills `/listing/tree` for the scoped world (fashion/furniture) and stores
  `config_json.nodes[]={category_node_id, vertical, label, icon}`; per-tile rename/icon.
- **Mobile** (`SectionRenderer.js`): the `nav_tiles` mapper passes `category_node_id`
  + `vertical` through (one-line fix). Tap → `navigateCategory` → CategoryBrowser
  (already built in Phase 1).

## Out of scope
- No migration (members live in `section_config.config_json`).
- Auto-narrow modes (Business page = only that business's listed categories; Creator
  store = only categories the creator promotes) — a later context-aware enhancement.
- Per-tile IMAGE rendering (rail uses label + optional icon for v1).

## Grounding (file:line)
- Render: `SectionRenderer.js:309-318` (nav_tiles → CategoryRail), `navigateCategory`
  node branch `:33-40` (built Phase 1).
- Picker pattern reused from `admin/section-library/page.js:69-72,239-253` (getListingTree
  + flattenTree + indented click list).
- Engine passes `ctx.config`=config_json, `ctx.vertical`=scopeValue (`sectionEngine.service.js`).

## Acceptance
- Admin can drill fashion/furniture, tick nodes, see them as selected tiles, rename/icon,
  publish. A node-backed `nav_tiles` row persists with `config_json.nodes[]`.
- Backend `category_nodes` rule emits those tiles with `category_node_id` + vertical.
- App renders the rail; tapping a tile opens CategoryBrowser at that node.
- Existing nav_tiles (world nav) + every other section unchanged.
