# 04 — Workflow prediction (mockup-lock)

The mockup `mockups/category-browser.html` is the locked Phase-1 design (founder
locked in-chat 2026-06-27, "lock phase 1 mock and start").

Predicted on-screen behaviour the implementation must match:
- **Header:** back · title (= selected leaf / category) · search · share.
- **Breadcrumb:** segment › category › leaf.
- **Left rail:** sub-categories of the current parent; selected one highlighted
  (yellow tint + pink edge). Real names from `category_nodes` (e.g. Footwear →
  Flats / Heels / Wedges / Sandals / Sneakers / Sports / Boots / Juttis).
- **Filter chips:** a dark "Filters" button (with active count), a "Sort" chip, and
  one chip per facet actually present (Size / Brand / Colour / Material …). Active
  facet → pink chip with count.
- **Grid:** 2-col product cards — image, name, brand, price, struck mrp, % off, rating.
- **Filter sheet:** bottom sheet, sort options + each facet's values (with counts) as
  toggle pills, Clear-all + Apply.

Real vs placeholder: category names + facet types are real (from the live tree/facets);
product names/prices/photos are placeholders filled by live data.
