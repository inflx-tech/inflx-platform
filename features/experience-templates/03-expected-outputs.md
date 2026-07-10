# Expected Outputs — Experience Templates (Phase 5)

## POST /v1/admin/experience-templates
Body: `{ world_key:"fashion", template_type:"creator", theme_key:"street_style", design_layout_key:"hero_banner", section_style:"hero", name?:"Street Style Hero" }`
```json
{ "success": true, "data": { "template": {
  "id": "tpl_…", "world_key": "fashion", "key": "street_style_hero", "name": "Street Style Hero",
  "template_type": "creator", "theme_key": "street_style", "design_layout_key": "hero_banner",
  "section_style": "hero",
  "placement_json": { "screens": ["home"], "audiences": ["all"] },
  "store_rule": "if_products", "creator_store_rule": "if_creator_has_experience",
  "location_priority": ["city","state","country","global"], "status": "draft"
} } }
```

## POST /v1/admin/experience-templates/:id/place
Upserts a `section_config` row and returns it:
```json
{ "success": true, "data": { "section": {
  "id": "sec_…", "screen": "category", "scope_type": "vertical", "scope_value": "fashion",
  "shelf_key": "tpl_street_style_hero", "title": "Street Style", "shelf_type": "mixed",
  "rule": "experience_template", "template_id": "tpl_…", "enabled": true, "position": 20
} }, "meta": { "note": "renders empty until creators publish experiences (Phase 6)" } }
```

## GET /v1/admin/experience-templates?world_key=fashion
```json
{ "success": true, "data": { "templates": [
  { "id": "tpl_…", "key": "street_style_hero", "name": "Street Style Hero", "template_type": "creator",
    "theme_key": "street_style", "design_layout_key": "hero_banner", "section_style": "hero",
    "status": "placed" }
] } }
```

## Section engine — the new rule (Phase 5 behaviour)
`experience_template` rule for a `template_id` → resolves published creator experiences bound to that template. In Phase 5 there are none → returns `[]`. The engine's hide-empty drops the section. Existing shelves resolve exactly as before (proven: the follower home payload is unchanged).

## Screen states
- **Templates list:** cards (name, theme+design+style chips, type, Draft/Placed pill).
- **Builder:** Type → Theme → Design → Section Style → Placement → rules; Save + Place.
- **Empty:** "No templates yet — assemble one from a theme + design."

## Non-goals (must NOT appear)
- No creator experiences / real render (Phase 6).
- No change to any existing section or the live home.
- No mobile/follower code change.
