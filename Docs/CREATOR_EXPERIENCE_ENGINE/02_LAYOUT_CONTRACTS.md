# 02 — Layout Contracts (the renderer's rulebook)

> A Layout Contract declares, per layout, what it **needs**, what it **may show if there's room**, and what it **never renders**. The Adaptive Renderer (Phase 4) obeys the contract for every size. This is the single artifact that guarantees every style looks good with **one Asset Pack and no manual artwork**.
> Stored as `design_layouts.contract_json` (see `01_DATA_MODEL.md`).

## Slot vocabulary (the ingredients a layout can place)
`background` · `featured_image` · `avatar` (creator) · `creator_name` · `title` · `subtitle` · `cta` · `offer_badge` · `products` · `price`

Rules:
- **Required** — must be present. If the Asset Pack lacks it, the experience **cannot publish into that layout** (enforced against the Theme's `media_rules_json`).
- **Optional** — render only if space allows (size + text length thresholds decided by the renderer).
- **Hidden** — never rendered for this layout, even if present.
- **Positions** come from `design_presets.positions_json` as a *preference*; the contract has the final say per size (e.g. Story forces title to bottom).

---

## Contract table (v1 layouts)

| Layout | Aspect | Required | Optional (if room) | Hidden |
|---|---|---|---|---|
| **Hero Banner** | 16:9 | background, featured_image, title | subtitle, cta, offer_badge, avatar, creator_name | products, price |
| **Split Banner** | 2×1:1 | featured_image, title | subtitle, offer_badge, avatar | cta, products, price |
| **Medium Card** | 4:5 | featured_image, title | avatar, creator_name, offer_badge | subtitle, cta, products |
| **Small Tile** | 1:1 | featured_image, title | avatar | subtitle, cta, offer_badge, products, price |
| **Story Card** | 9:16 | featured_image, avatar | title, offer_badge | subtitle, cta, products, price |
| **Magazine Card** | 4:5 | background, featured_image, title | subtitle, creator_name, avatar | offer_badge, products |
| **Product Shelf Header** | flex | title | avatar, creator_name, offer_badge | featured_image, subtitle, cta |
| **Category Mosaic Tile** | 1:1 | featured_image, title | offer_badge | subtitle, cta, avatar, products |
| **Horizontal Carousel Card** | 3:4 | featured_image, title | offer_badge, price | subtitle, cta, avatar |
| **Bento Tile** | flex | featured_image | title | subtitle, cta, avatar, offer_badge, products |

> Automatic-type templates (no creator) use the same contracts but with `avatar`/`creator_name` absent from the pack — the renderer simply skips them (they're Optional/Hidden everywhere they appear).
> Mixed templates always try to satisfy `offer_badge` where it is Optional.

---

## Renderer resolution order (Phase 4 spec)
1. Load Template → Theme → Preset tokens (mood, palette, typography, background, radius, shadow).
2. Load the Asset Pack (creator fill) + Theme static copy (title/subtitle/cta defaults).
3. Load the target layout's contract.
4. For each slot: Required → place; Optional → place if space heuristic passes; Hidden → skip.
5. **Featured-image auto-pick:** choose the pack image whose `aspect` best fits the layout (`landscape→hero`, `portrait→story`, `square→tile`); smart-crop otherwise.
6. Apply tokens (background from library, palette colors, typography style) and preset positions, overridden by contract where they conflict.

## Publish-time validation (Phase 6)
When a creator publishes an experience against a Template, validate the Asset Pack + Theme rules satisfy the **Required** set of the Template's layout. If not → block publish with a clear reason (e.g. "This layout needs a landscape featured image"). This is where the Theme's `min_products` / `media_rules_json` are finally enforced — closing the old "sections could be placed empty" gap.

## Open items to confirm
- Exact **space heuristics** for Optional slots (text length + min pixel thresholds) — decided during Phase 4 with on-device testing, not on paper.
- Whether **price** is ever surfaced on experience cards or only inside product detail — recommend product-detail only for v1.
