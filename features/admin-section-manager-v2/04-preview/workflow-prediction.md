# Workflow Prediction — admin-section-manager-v2 (Part A)

## Design source
The Admin Section Manager panels in the comprehensive mockups
(`design/wave4-creator-vibe/home-comprehensive.html` + `category-comprehensive.html`
right-hand "Admin — Section Manager" columns): drag/reorder, toggle, count, item-
type dropdowns, **city selector**, **per-vertical tabs**, **＋ Add Section**, and
**"edit ▾"** on sub-category-chip / filter rows (i.e. config editing). Part A
implements the still-missing pieces (rename, config edit, Add, scope).

## What the reviewer should see
- A **scope** control (Global / City <name> / Vertical <key>) at the top.
- Each shelf row: an **editable title**, an **Edit details** expander (caption,
  chip/filter labels, nav-vertical labels+icons, advanced JSON), plus the existing
  reorder/toggle/count/type/delete.
- An **＋ Add Section** control (preset → new draft shelf).
- **Publish** persists; "live within ~60s" hint.

## Honest notes
- Backend already supports title/config/insert/scope — Part A is the UI.
- Advanced JSON validates before apply; backend re-validates on save.
- Greeting + admin-curated sub-cat chips are Part B (migration + OTA), not here.

## After-capture
Playwright/manual screenshot of `/admin/sections` (founder/admin auth), paired
against the admin mockup panel.
