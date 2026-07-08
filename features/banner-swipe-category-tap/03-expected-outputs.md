# Expected outputs — banner-swipe-category-tap

1. SectionRenderer category nav (section + tile) reads
   `category_node_id || node_id` → non-null nodeId when admin picked a category.
2. FullBleedStyle: >1 valid tile → paged horizontal ScrollView + dots; ≤1 →
   single static card.
3. brand-web full_width_banner hint mentions multi = swipeable.
4. Mobile component tests pass; brand-web builds; `pnpm qa` GREEN.
