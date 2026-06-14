# 01-spec — Bugfix: category screen ignores admin category→business linkage

## Problem (prod, founder-reported 2026-06-14)
Opening a follower category tile (e.g. **Shop / Fashion**) shows businesses from
*other* categories (restaurants under "Shop"). Admin renames/edits to the
category tiles appeared to be "just names" with no real link to businesses.

## Root cause (verified file:line)
There are TWO follower category screens:
- `/category/:super_category/stores` (`follower.controller.getCategoryStores`)
  filters `b.category IN (superCat.sub_categories)` where `sub_categories` =
  `follower_categories.member_categories` — **correct**.
- The rich section-engine screen (`getCategorySections` → `sectionEngine.buildSections`
  → `sectionRules` listing rules) resolves the category via `categoryFilter` →
  the **hardcoded `CATEGORY_MAP`** (keys `dining/shopping/groom/...`). The admin
  table keys are `eat/shop/groom/...`. Keys don't match → `categoryFilter` returns
  `null` for `eat/shop/fitness/home` → **no category filter → every business
  (incl. restaurants) leaks into the screen.** (`groom/travel/events` match by
  coincidence so they happened to work.)

The admin linkage IS real: `follower_categories.member_categories` (editable in
Admin → Follower Categories → "Member businesses"). The section engine just
wasn't reading it.

## Fix
Make the section engine the single source of truth read `member_categories`:
- `sectionEngine.buildSections` loads `follower_categories` once
  (`loadCategoryMembers`) and injects `ctx.categoryCats` per shelf (keyed by the
  shelf's resolved category key).
- `sectionRules.categoryFilter(ctx)` prefers `ctx.categoryCats`; falls back to the
  legacy `CATEGORY_MAP` only when the table has no row for the key (legacy
  `section_config.category_key` like `dining`, or a DB read failure).

## Scope
Backend only. No migration. No API/shape change. **Not UI-governed.**

## Out of scope
Mobile `CategoryPills.js` hardcoded list; full `CATEGORY_MAP` removal (kept as
resilience fallback) — Section-Library phase reconciliation.
