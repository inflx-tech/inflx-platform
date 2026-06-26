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
