# 03 — Token & Preset Catalog (Phase 1 seed spec)

> The admin is a **curator, not a designer**. These libraries are the vocabulary they pick from. Built once (designer or AI), seeded like your master dictionaries (`feedback_csv_first_seeds`), grown without deploys.
> Stored in `design_tokens` (by `kind`) and `design_presets` (bundles). See `01_DATA_MODEL.md`.

This file specifies the **starter set** for Fashion. Other worlds (Food, Beauty, Furniture) reuse the same structure with their own seeds.

---

## 1. Moods (`kind='mood'`) — the feeling
`urban` · `luxury` · `minimal` · `bright` · `vintage` · `festival` · `nature` · `sports`
`config_json`: `{ "descriptor": "…", "default_palette": "urban_dark", "default_typography": "bold_fashion" }`

## 2. Palettes (`kind='palette'`) — named, no color-picker
| key | intent | swatches (primary / secondary / accent / bg / text) |
|---|---|---|
| `urban_dark` | street, bold | #26262A / #5F5E5A / #FFC400 / #1C1C1E / #FFFFFF |
| `minimal_white` | clean editorial | #FFFFFF / #F1EFE8 / #1A1A1A / #FFFFFF / #1A1A1A |
| `summer_warm` | bright, playful | #D85A30 / #F0997B / #378ADD / #FAECE7 / #4A1B0C |
| `luxury_mono` | premium | #1A1A1A / #888780 / #C9A24B / #F1EFE8 / #1A1A1A |
| `earthy` | boho, natural | #5F5E5A / #9FE1CB / #1D9E75 / #E1F5EE / #04342C |
| `night` | date-night, moody | #26215C / #534AB7 / #AFA9EC / #1C1C24 / #EEEDFE |
`config_json`: the hex map above under keys `{primary,secondary,accent,bg,text}`.

## 3. Typography (`kind='typography'`) — choose a style, not a font
| key | label | resolves to (family / weight / spacing) |
|---|---|---|
| `bold_fashion` | Bold Fashion | Inter / 800 / -0.02em |
| `luxury_serif` | Luxury Serif | (serif) / 600 / 0 |
| `minimal_sans` | Minimal Sans | Inter / 500 / 0 |
| `editorial` | Editorial | Inter / 700 / -0.01em, larger scale |
| `modern` | Modern | Inter / 600 / 0.01em |
| `sporty` | Sporty | Inter / 800 / 0.02em uppercase |
> INFLX house font is Inter (`project_creator_commerce_vision` UI language). Serif reserved for luxury.

## 4. Backgrounds (`kind='background'`) — **curated library, admin PICKS (D5)**
Starter categories (target ~100 over time; seed ~16 first):
`urban_concrete` · `studio_wall` · `soft_blur` · `flat_gradient` · `cafe` · `minimal_paper` · `street_wall` · `outdoor` · `luxury_marble` · `yellow_gradient` · `green_nature` · `festival_lights` · `travel_sky` · `beach` · `fabric` · `denim`
`config_json`: `{ "type": "texture|flat|gradient", "asset_r2_key": "…", "avg_color": "#…", "text_safe_zone": "bottom-left" }`
> No admin upload of artwork. No procedural generation in v1.

## 5. Radius & Shadow (`kind='radius'` / `'shadow'`)
`radius`: `sharp(4) | soft(12) | round(20)` · `shadow`: `none | soft | elevated`

---

## 6. Design Presets (`design_presets`) — the LEGO starter bundles
Admin starts a Theme from one of these; edits only name/subtitle/icon.

| preset key | mood | palette | typography | background | radius / shadow |
|---|---|---|---|---|---|
| `urban_fashion` | urban | urban_dark | bold_fashion | urban_concrete | soft / soft |
| `luxury_editorial` | luxury | luxury_mono | luxury_serif | luxury_marble | soft / elevated |
| `summer_collection` | bright | summer_warm | modern | yellow_gradient | round / soft |
| `travel_lifestyle` | nature | earthy | editorial | travel_sky | soft / soft |
| `minimal_fashion` | minimal | minimal_white | minimal_sans | minimal_paper | sharp / none |
| `sports_active` | sports | urban_dark | sporty | studio_wall | soft / soft |
| `festive_collection` | festival | night | bold_fashion | festival_lights | round / elevated |
| `premium_boutique` | luxury | luxury_mono | luxury_serif | fabric | soft / elevated |
`positions_json` per preset: preferred slot positions (e.g. urban_fashion → avatar top-left, featured right, cta bottom-left). Contract overrides per size (see `02`).

---

## 7. Blueprints (seeded themes, `experience_themes.is_blueprint=true`)
Ship starter themes grouped by purpose; "Create Theme" clones one.
- **Lifestyle:** Street Style, Minimal, Old Money, Boho
- **Occasion:** Wedding, Office, Date Night, Festival
- **Travel:** Airport, Vacation, Weekend Trip
- **Budget:** Under ₹499, Under ₹999, Premium Picks
- **Category:** Sneakers, Shirts, Jewellery, Ethnic Wear
- **Trend:** New Drops, Summer State of Mind, Monsoon Ready

Each blueprint pre-fills: preset, supported categories, media rules, supported offers, default copy, suggested mood.

---

## 8. The one-time design-asset workstream (honest cost)
Before Phase 1 admin screens are useful, someone (designer or AI) produces **once**:
- the palette/typography/radius/shadow token values (small),
- ~16 starter background assets (grows to ~100),
- the ~8 presets’ positions,
- ~20 blueprint themes’ pre-fills.
This is a bounded content project, **not free**, and is tracked as part of Phase 1 — not assumed to appear automatically.
