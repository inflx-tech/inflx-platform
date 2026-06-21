# Diff notes — Reusable customisation templates

Founder ask: let restaurants save add-on/variation groups and reuse them across
dishes (general vs product-specific).

What was built:
- Migration 117: `brand_addon_templates` (brand-scoped, jsonb definition,
  UNIQUE(brand_id, lower(name))). Applied to prod.
- Backend: GET/POST(upsert)/DELETE /brands/me/addon-templates
  (brandAddonTemplates.controller).
- Customise modal: "Add from saved" (lists the library; applying drops a COPY of
  the group into the current dish, editable independently) + per-group "Save as
  reusable" (promotes a group to the library) + a "saved to your library" note.
- lib/api: getAddonTemplates / saveAddonTemplate / deleteAddonTemplate.

Model = copy-on-apply (not live-linked) → editing one dish never changes another,
and order snapshots are unaffected.

Verified: food-addon-templates.test.js 3/3 (save/list/upsert-by-name, delete,
validation). brand-web next build exit 0.
