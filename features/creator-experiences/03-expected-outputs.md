# Expected Outputs — Creator Experience Studio (Phase 6)

## GET /v1/influencers/me/experience-templates?world_key=fashion
```json
{ "success": true, "data": { "templates": [
  { "id": "tpl_…", "key": "street_style_hero", "name": "Street Style Hero",
    "theme_key": "street_style", "design_layout_key": "hero_banner", "section_style": "hero",
    "theme": { "title": "Street Style", "subtitle": "Urban looks curated…", "cta": "Explore collection",
               "min_products": 4, "max_products": 20, "media_rules": { "featured": "required" } } }
] } }
```

## POST /v1/influencers/me/experiences
Body: `{ template_id:"tpl_…", product_ids:["p1","p2","p3","p4"], featured_image_url:"https://…/rahul.jpg" }`
```json
{ "success": true, "data": { "experience": {
  "id": "exp_…", "influencer_id": "inf_…", "template_key": "street_style_hero", "theme_key": "street_style",
  "featured_image_url": "https://…/rahul.jpg", "status": "draft", "product_count": 4
} } }
```

## POST /v1/influencers/me/experiences/:id/publish
- Valid → `{ success:true, data:{ experience:{ …, status:"published" } } }`.
- Too few products (Theme min) or no featured → `{ success:false, error:{ code:"VALIDATION_ERROR", message:"Street Style needs at least 4 products.", field:"product_ids" } }` (422), stays draft.

## Engine — experience_template rule (Phase 6 behaviour) for a placed template
Resolves published experiences bound to the template → one render item per experience:
```json
{ "entity_type": "experience", "id": "exp_…",
  "render_spec": { "theme": {…}, "design": { "layout_key":"hero_banner", "aspect_hint":"16:9", "contract":{…} },
    "tokens": {…}, "pack": { "creator_name":"Rahul", "avatar_url":"…", "featured_images":[{"url":"…/rahul.jpg","aspect":"landscape"}],
      "offer_badge": null, "products":[…] },
    "resolved": { "visible_slots":[…], "featured_pick":{…}, "blocked": false } },
  "via_creator": { "id":"inf_…", "handle":"rahul.style", "name":"Rahul" } }
```
Before any publish, the rule returns `[]` (section hidden) — unchanged from Phase 5.

## Follower feed — GET /v1/follower/section/category/fashion
The placed Street Style section now carries `items: [ …one per published experience ]`; every existing section resolves exactly as before.

## Mobile (6b) — observable
- Studio: Available Templates list → pick → product picker → featured image → Publish → "Published".
- Follower home: the Street Style section renders the experience via AdaptiveRenderer.

## Non-goals (must NOT appear)
- Full multi-image Asset Pack / per-context imagery (Phase 7) — single featured_image_url.
- Scoped/theme proposals (Phase 8); automatic/mixed data rules (Phase 9).
