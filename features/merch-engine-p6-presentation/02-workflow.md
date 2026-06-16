# 02 — Workflow: Phase 6 Presentation Types

## Admin authoring (real-time, no app update)
1. (Pre-exists) Build the rule in **Section Library**; for Hero-Tiles, group
   member sections into a **Collection**.
2. **App Sections** → Add placement → pick Section (Banner) or Collection (Hero+Tiles).
3. Open ⚙ → **Presentation**: Row / Banner / Hero+Tiles.
   - Banner → type eyebrow / headline / CTA + paste image URL (live preview).
   - Hero+Tiles → set hero title + image URL; tiles auto-list from the collection.
4. **Publish** → live in the follower app within ~60s (engine cache TTL).

## Follower runtime
- Banner placement → a banner card on the screen → tap → `SectionResults` runs the
  section rule with the surface context (creator/brand/category/city/gate) → grid.
- Hero+Tiles placement → hero header + tiles → tap a tile → `SectionResults` for
  that member section's rule, same context stacking.

## Non-goals
No change to existing row placements, gating, tracking, or the results pipeline.
