# 02 — Workflow: admin-frame-banner-rule

## Admin
1. App Builder → Home → Fashion → add an image-tiles section (any style).
2. Per tile: upload an image + (optionally) type a label.
3. Fill the inline rule — any of: Under ₹ · Min % off · Brand · tags · has-offer.
   All optional; leave blank to use a wired Section Library group instead.
4. Publish → each tile persists `config_json.tiles[i].rule_json` (+ `business_type`
   = the world) so results stay scoped.

## Follower (tap → grid)
5. Tile renders (existing image-tile look).
6. Tap → `SectionResults` runs `library_products` with the tile's inline `rule_json`
   as `ctx.ruleDef`; `rule_json.business_type` scopes by world.
7. The grid shows the matching products (e.g. Nike ≥40% off; or under ₹99).

## Failure modes
- Empty rule_json → wired group used; if neither → empty/scoped-world list.
- Malformed rule_json → ignored (empty rule), no 500.
- Brand typo / different case → case-insensitive match mitigates; unknown brand → empty grid.
