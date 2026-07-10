# Expected Outputs — Theme Library (Phase 2)

## GET /v1/admin/themes/blueprints?world_key=fashion
```json
{ "success": true, "data": { "blueprints": [
  { "key": "street_style", "name": "Street Style", "icon": "👟", "purpose": "lifestyle",
    "preset_key": "urban_fashion", "audience": "unisex" },
  { "key": "airport_looks", "name": "Airport Looks", "icon": "✈️", "purpose": "travel",
    "preset_key": "travel_lifestyle", "audience": "unisex" }
  /* … ~20 total, grouped by purpose in the UI */
] } }
```

## POST /v1/admin/themes  (body: { world_key, from_blueprint_key: "street_style" })
Clones the blueprint's fields into a new draft:
```json
{ "success": true, "data": { "theme": {
  "id": "th_…", "world_key": "fashion", "key": "street_style", "name": "Street Style",
  "subtitle": "Urban looks curated for everyday confidence.", "icon": "👟",
  "purpose": "lifestyle", "audience": "unisex", "preset_key": "urban_fashion",
  "supported_categories": ["<node_id>", "…"], "min_products": 4, "max_products": 20,
  "media_rules": { "featured": "required", "video": "optional", "orientation": "portrait" },
  "supported_offer_types": ["discount","bundle","bogo","free_gift"],
  "default_title": "Street Style", "default_subtitle": "Urban looks curated for everyday confidence.",
  "default_cta": "Explore Collection", "applicable_worlds": ["fashion"],
  "is_blueprint": false, "blueprint_source_key": "street_style", "status": "draft"
} } }
```

## PATCH /v1/admin/themes/:id  → returns the updated theme (same shape).

## POST /v1/admin/themes/:id/publish
- Valid → `{ success: true, data: { theme: { …, status: "published" } } }`.
- Invalid → `{ success: false, error: { code: "VALIDATION_ERROR", message: "…", field: "supported_categories" } }` (422), theme stays `draft`.

## GET /v1/admin/themes?world_key=fashion&status=
```json
{ "success": true, "data": { "themes": [
  { "id": "th_…", "key": "street_style", "name": "Street Style", "icon": "👟",
    "purpose": "lifestyle", "preset_key": "urban_fashion", "status": "published",
    "product_count_range": "4–20" }
] } }
```

## Screen states
- **Library loaded:** grid of theme cards (icon, name, purpose, preset chip, status pill).
- **Blueprint picker:** ~20 cards grouped by purpose.
- **Wizard:** pre-filled sections; Save draft + Publish; inline validation on publish.
- **Empty:** "No themes yet — start from a blueprint."

## Non-goals (must NOT appear)
- No template/design/section-style controls (Phase 3/5).
- No renderer/preview of a rendered banner (Phase 4).
- No mobile/follower surface.
