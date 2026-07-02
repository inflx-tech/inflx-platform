# Workflow prediction — admin-frame-builder-ux

## Mockup — `tile-editor.html`
Predicts the revised Frame tile editor:
- Section title field shown as the app name with a clear placeholder (no "Spotlight").
- No wireframe preview block.
- Labeled rule form (Category · Brand · Price under/above · % off · Tags · Only-with-offer).
- Per-tile "On tap →" dropdown (Product grid / Category browser / A page).

Prediction: values write `title`, `tiles[i].rule_json` (subcategory_node_id/brand/
price_max/price_min/min_discount_pct/tags/has_offer), and `tiles[i].tap_destination`.

## Admin prediction
Publish blocks on any blank title. The labeled form composes "jeans under ₹499 in
Adidas". Per-tile destination + section-level-hidden-for-frames verified by build/lint.

## Follower prediction
`SectionRenderer` tile tap → category/page/grid per `tap_destination`. Verified by
founder walk (reuses shipped screens), not Playwright.
