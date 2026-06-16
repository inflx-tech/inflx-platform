# 06 — Before/After Diff Notes: Category screen rebuild

Locked reference: `../04-preview/mockups/category.html` (Creators Vibe Yellow).

## Finding
Category detail (`CategoryListScreen`) was already rebuilt in Phase 5 — section-driven,
gold/cream, sub-category circles, "View all" headers, product cards with struck MRP.
It already matches the locked mockup B. Source gold `#F4B40D` vs token `#F6B11E` < 1%
difference → no global token churn.

## Implemented
- `vibe/CategoryCircle.js`: inactive circle fill grey `#F1F1F1` → cream (`C.soft`);
  active = cream fill + 2px gold ring (was solid-gold fill); active label stays gold.
  Matches the source `.catcircle` (beige circle, gold-ring-on-active). Applies to the
  Category sub-category bar and Home's "Browse by Category" row.

## Not done (by design, noted)
- All-Categories list (mockup A) = Home's existing 5-tile grid; no standalone screen
  added (no nav entry; speculative). Follow-up if founder wants it.
- No cart icon in the category appbar until checkout exists (Phase 8).

## Verification
- `pnpm qa`: GREEN gate 0 (mobile change inert to web/backend tests).
- Before/after = device screenshot at founder verify (OTA).
