# 05 — Impact

**Verdict:** additive — one new rule, one new admin preset + picker, one-line mobile
mapper change. Zero change to existing sections/flows.

## Functional disturbance
- **None.** No migration, no schema change. The new rule `category_nodes` is additive;
  existing rules untouched. The new admin preset is opt-in.
- The mobile `nav_tiles` mapper now also passes `category_node_id`/`vertical`; items
  that lack them (the legacy world-nav row) are unaffected — `navigateCategory` only
  branches when `category_node_id` is present (built Phase 1).

## Surfaces touched
- backend: `sectionRules.service.js` (+`categoryNodes` rule, +registry line).
- admin: `brand-web/app/admin/sections/page.js` (+preset, +tree loader, +node helpers,
  +picker UI, +templateLabel/flattenTree).
- mobile: `SectionRenderer.js` (nav_tiles mapper passthrough).

## Deploy classification
**Production-impacting** (backend/src + brand-web + mobile runtime). Backend → Render,
admin → Vercel, mobile → OTA. **No migration.** Surfaced for explicit go.

## Risk
- Low. Picker only active for fashion/furniture worlds (they have a tree).
- `release.released` stays false (no Maestro device, per program precedent).
