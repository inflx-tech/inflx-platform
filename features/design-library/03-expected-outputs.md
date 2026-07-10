# Expected Outputs — Design Library (Phase 3)

## GET /v1/admin/design-layouts?world_key=fashion
```json
{ "success": true, "data": { "layouts": [
  { "key": "hero_banner", "label": "Hero Banner", "kind": "banner", "aspect_hint": "16:9",
    "contract": { "required": ["background","featured_image","title"],
                  "optional": ["subtitle","cta","offer_badge","avatar","creator_name"],
                  "hidden": ["products","price"] } },
  { "key": "small_tile", "label": "Small Tile", "kind": "card", "aspect_hint": "1:1",
    "contract": { "required": ["featured_image","title"], "optional": ["avatar"],
                  "hidden": ["subtitle","cta","offer_badge","products","price"] } },
  { "key": "story_card", "label": "Story Card", "kind": "card", "aspect_hint": "9:16",
    "contract": { "required": ["featured_image","avatar"], "optional": ["title","offer_badge"],
                  "hidden": ["subtitle","cta","products","price"] } }
  /* … 10 total, exactly per 02_LAYOUT_CONTRACTS.md */
] } }
```

## GET /v1/admin/section-styles
```json
{ "success": true, "data": { "section_styles": [
  { "key": "carousel", "label": "Carousel", "hint": "horizontal scroll of cards" },
  { "key": "grid",     "label": "Grid",     "hint": "even columns" },
  { "key": "masonry",  "label": "Masonry",  "hint": "staggered heights" },
  { "key": "collage",  "label": "Collage",  "hint": "mixed-size mosaic" },
  { "key": "story_rail","label": "Story rail","hint": "circular story reels" },
  { "key": "tabs",     "label": "Tabs",     "hint": "tabbed sets" },
  { "key": "bento",    "label": "Bento",    "hint": "mixed-size grid" },
  { "key": "split",    "label": "Split",    "hint": "two side-by-side" },
  { "key": "hero",     "label": "Hero",     "hint": "single full-width slide(s)" },
  { "key": "magazine", "label": "Magazine", "hint": "editorial layout" }
] } }
```

## Screen states
- **Loaded:** Layouts panel (10 cards with contracts) + Section Styles reference.
- **Empty (pre-seed):** "No layouts seeded yet."
- **Forbidden:** deny per existing admin-auth pattern.

## Non-goals (must NOT appear)
- No contract editing (read-only v1).
- No renderer/preview of a rendered banner (Phase 4).
- No template binding (Phase 5), no mobile/follower surface.
