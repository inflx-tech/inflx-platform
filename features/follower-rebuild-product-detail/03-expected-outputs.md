# 03 — Expected Outputs: Product Detail rebuild

- Product title renders in Jakarta **bold** (not serif).
- Rating shows 5 star glyphs filled to the value + review count.
- Size selector = full-width boxes; active = gold fill + ink text.
- Hero ~332h; price ~22px; discount/creator/CTA all still render.
- Per-vertical CTAs intact (fashion = Pay-at-Store + Add-to-Cart; restaurant = Add
  + Pay; salon/car = Book) — no functional regression.
- `pnpm qa` 79/79 GREEN gate 0 (mobile-only, inert to web/backend).
