# 06 — Before/After · Section-editor redesign
Before: each section row had legacy "(no category)" + item-type dropdowns
(re-asking the world already chosen at the top), the rule was baked into the
preset (no explicit pick), no preview, and a beauty default title ("Serums for
healthy skin") leaked onto other worlds.

After: row shows a friendly template name; expanding shows a TemplatePreview
wireframe (see the shape) then a "What fills it? (rule)" dropdown for data
templates (creators/products/brands) — template→rule explicit. Per-tile
image-upload + wire-to-group kept. Legacy dropdowns + dead helpers (hasTypeControls,
changeType, ITEM_TYPES, RULE_FOR_TYPE) deleted; default titles neutralized; raw
JSON behind Advanced.

Verify: brand-web next build exit 0. admin-web only, no mobile/migration.

## Round 2 — founder feedback fixes (2026-06-26)
1. Deleted the "Advanced — raw config JSON" flap (legacy) + its dead onJsonChange.
2. Library/rule "wire to a group" + "pick a section" dropdowns now filtered to the
   current world (worldSections = business_type === scopeValue || 'ALL') — Home→Food
   shows only food groups, not All Fashion etc.
3. Wider layout (max-w-4xl → max-w-6xl) — uses more of the screen.
4. Delete made obvious — the faint ✕ is now a clear "🗑 Delete" button (was already
   functional via deleteSection; now unmistakable vs the on/off toggle).
Verified: brand-web build exit 0; pnpm qa GREEN(79) (one transient API-backend
timeout run, re-ran GREEN). DEFERRED (founder wants to discuss): pruning/grouping
the template list + per-template behaviour.
