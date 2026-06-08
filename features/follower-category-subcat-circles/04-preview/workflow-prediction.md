# Workflow Prediction — follower-category-subcat-circles

## Design source
Founder design revision (2026-06-08): the Category sub-category selector becomes a
**round-circle carousel** instead of the pill chips in the locked
`category-comprehensive.html`. The visual language reuses Home's Browse-by-Category
circles (round icon tile + label), with the active sub-type highlighted (brown
tile + brown label). This is an intentional, recorded deviation from the locked
mockup, requested by the founder.

## What the reviewer should see
- Sticky top bar = horizontal carousel of round circles: "All" (super-cat icon)
  then each real sub-type (e.g. 🍽️ Restaurants, 🧁 Bakery), icon from the category
  accent. Tap → filter; active circle = brown tile + brown label.

## Honest notes
- Sub-types are the real ones present in the live payload (not a fixed list);
  finer types await the frozen drill-down taxonomy.
- "All" uses the super-category icon as its glyph.

## After-capture
Maestro/APK screenshot of the Eat Category screen (founder-side), per
`category-circles.maestro-flow.json`.
