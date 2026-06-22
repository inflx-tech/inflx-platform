# 01 — Spec · Category rail as a placeable sticky section (roadmap #1)

Make the "What's on your mind?" craving rail a SECTION the admin places in a
world's stack (not hardcoded), and let admin mark ANY section sticky.

## Changes
- **Backend:** new rule `world_categories` → a world's `follower_vertical_categories`
  (Home Builder tiles), for shelf_type `category_rail`. Read-only.
- **Admin (App Sections):** "Category rail (sticky-able)" preset; a 📌 **Sticky**
  toggle on every section row (writes `config_json.sticky`).
- **Mobile:** `CategoryRail` component (the rail UI). `SectionRenderer` exports
  `SectionItem` (per-section element) + counts `category_rail` as content +
  skips it in the generic renderer. `HomeScreen` lays sections out as direct
  ScrollView children (tabs+search scroll away), applies `stickyHeaderIndices`
  for sections with `config.sticky`, renders the rail via `CategoryRail`, and
  its tile tap drives the in-page craving filter (stays visible while filtered).

## Out of scope
The template catalog (#2). Creator Home. 3C-2/3C-3.
