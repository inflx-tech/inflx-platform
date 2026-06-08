# Workflow — follower-category-subcat-circles

1. Add `active` prop to `vibe/CategoryCircle` (brown tile + brown label selected).
2. `CategoryListScreen`: render the sticky sub-cat bar as a horizontal carousel of
   `CategoryCircle` (sub-type icon + label), active = the selected sub-type; tap →
   filter the brand/product shelves (existing client-side filter).
3. Sub-cat list = real sub-types in the payload, each `{label, icon}` (icon from
   `getBusinessAccentLight(key).icon`; "All" = the super-category icon).
4. Babel transform; `pnpm qa` GREEN; `06-diff/notes.md`; OTA for founder go.

## End state
Category's top sub-category selector is a round-circle carousel (icon + label,
active highlighted), consistent with Home's category circles. Filtering works.
