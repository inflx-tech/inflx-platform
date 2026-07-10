# Expected Outputs — Adaptive Renderer (Phase 4)

## GET /v1/admin/experience-preview?theme_key=street_style&layout_key=hero_banner&world_key=fashion
```json
{ "success": true, "data": { "render_spec": {
  "theme": { "key": "street_style", "name": "Street Style",
             "title": "Street Style", "subtitle": "Urban looks curated for everyday confidence.",
             "cta": "Explore collection" },
  "design": { "layout_key": "hero_banner", "aspect_hint": "16:9",
              "contract": { "required": ["background","featured_image","title"],
                            "optional": ["subtitle","cta","offer_badge","avatar","creator_name"],
                            "hidden": ["products","price"] } },
  "tokens": {
    "palette": { "primary": "#26262A", "secondary": "#5F5E5A", "accent": "#FFC400", "bg": "#1C1C1E", "text": "#FFFFFF" },
    "typography": { "family": "Inter", "weight": 800, "spacing": "-0.02em" },
    "background": { "type": "texture", "avg_color": "#3a3a3d", "asset_r2_key": null },
    "radius": 12, "shadow": "soft"
  },
  "pack": {
    "creator_name": "Rahul",
    "avatar_url": "https://…/sample/rahul.png",
    "featured_images": [
      { "url": "https://…/sample/street_landscape.jpg", "aspect": "landscape" },
      { "url": "https://…/sample/street_portrait.jpg",  "aspect": "portrait" },
      { "url": "https://…/sample/street_square.jpg",    "aspect": "square" }
    ],
    "offer_badge": "20% OFF",
    "products": [ { "name": "Oversized Tee", "price": 1299 }, { "name": "Sneakers", "price": 2499 } ],
    "copy": { "title": "Street Style", "subtitle": "Urban looks curated for everyday confidence.", "cta": "Explore collection" }
  },
  "resolved": {
    "visible_slots": ["background","featured_image","title","subtitle","cta","offer_badge","avatar","creator_name"],
    "featured_pick": { "url": "https://…/sample/street_landscape.jpg", "aspect": "landscape" },
    "blocked": false
  }
} } }
```

## resolveRenderSpec — invariants unit tests assert
- Every `contract.required` slot ⊆ `resolved.visible_slots`.
- No `contract.hidden` slot ∈ `resolved.visible_slots`.
- `featured_pick.aspect` matches the layout: 16:9→landscape, 9:16→portrait, 1:1→square (else nearest + crop).
- Required slot with no pack data → `blocked:true` + `missing:[slot]`.

## Mobile render (4b) — observable states
- Hero (16:9): background + landscape featured + title + subtitle + CTA + avatar + offer.
- Story (9:16): portrait featured + avatar + title only (subtitle/cta/products dropped).
- Small Tile (1:1): square-cropped featured + title + small avatar.
- Magazine (4:5): background + featured + title + subtitle + creator credit.

## Non-goals (must NOT appear)
- Real creator packs / experiences (Phase 6-7) — sample data only.
- Template binding / placement (Phase 5), follower-home wiring.
