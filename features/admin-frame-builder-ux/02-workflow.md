# Workflow — admin-frame-builder-ux

## Admin: name a section
1. Add a section → title is blank with a placeholder prompting a name.
2. Type the name shown in the app (e.g. "Deals in Men Fashion").
3. Publish — blocked with a clear message until every section has a name.

## Admin: build a tile rule (labeled form)
1. In a Frame tile → "Create a rule" → the labeled form:
   - **Category** (fashion/furniture tree) → e.g. Jeans
   - **Brand** → e.g. Adidas
   - **Price under ₹** → 499  (optional **Above ₹**)
   - **At least % off** → e.g. 40
   - **Tags** → tap chips from the world's vocabulary
   - **Only with a live offer** → toggle
2. All optional, combined with AND. "Save for reuse" pushes it to Section Library.

## Admin: per-tile destination
1. Each tile → **On tap →** dropdown:
   - **Product grid** → runs this tile's rule (default)
   - **Category browser** → pick a world
   - **A page** → pick a custom page
2. The section-level "On tap, go to…" is hidden for frames (per-tile wins).

## Follower: tap a tile (runtime)
- `SectionRenderer` tile `onTile` reads `tile.tap_destination`:
  `category` → `CategoryBrowser`; `page` → `FollowerPage`; else → the tile's rule
  in `SectionResults` (unchanged default).

## System / data
- Naming = `section_config.title`. Rule = `tiles[i].rule_json`. Destination =
  `tiles[i].tap_destination`. All ride `config_json`; no backend/migration.
