# 03 — Expected outputs

## Add-section menu (grouped)
- **Data sections — no rule:** Category rail (pick categories) · Products rail ·
  Businesses rail · Creators rail · Offers rail · Restaurants + dishes (food) ·
  Food cravings rail (food) · Menu (food, business).
- **Frame — image / banner:** Image / banner frame.
- **Controls:** Chips / filter bar.

## Section row
`<title> · <template>` + a tag: **NO RULE** (green) for data, **NEEDS A RULE** (pink) for tiles/frame.

## Frame banner (config_json.tiles[i])
- Create mode: `{ image_url, label, rule_json:{…conditions…, business_type} }`.
- Saved mode: `{ image_url, label, library_section_id, rule_mode:'saved' }`.
- Save for reuse → `POST /admin/section-library {business_type, name, rule_json}` then the
  banner is wired to the new id.

## Live preview
- Category rail → tiles for each picked node + an "All" tile.
- Image/banner frame → the uploaded images laid out in the chosen style.
- Data rails (products/creators/businesses/offers) → representative placeholder tiles.

## Category rail backend (rule `category_nodes`)
Appends `{ entity_type:'category', key:'all', label:'All', category_node_id:null }` after
the picked nodes (unless `config.hide_all`).
