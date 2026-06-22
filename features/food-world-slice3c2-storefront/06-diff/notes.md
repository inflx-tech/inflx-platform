# 06 — Diff notes · 3C-2a (interaction)

This push = 3C-2a (the ordering interaction). Storefront visual reskin (search/
filter/collapsible/MENU/toing recolor) = 3C-2b (next).

- CustomiseSheet (Toing img2): variation single-select sets base + multi add-on
  groups (select-up-to-N, Select All, +N more) + qty + live total + green Add Item.
- DishDetailSheet (Toing img3): big image, veg, price+MRP, rating, free-text desc,
  pink-outline ADD; ADD → customise (if add-ons) else direct add.
- CartContext: lines now carry {variation, selected_addons[], note}; line_key has a
  customisation signature (differently-built same-dish lines stay distinct).
- RestaurantDetailScreen: ＋ → fetch addon_groups → CustomiseSheet (or add); image →
  DishDetailSheet; local cart replaced by CartContext; cart bar reads the global cart;
  cross-brand replace guard reused. No backend/migration.

Verified: CustomiseSheet 1/1 (total math + resolved line), TileSection 5/5, HomeScreen
2/2, DishGroupResult 2/2. Pre-existing failures (FollowerWalletScreen transform,
RestaurantCartScreen happy-path) confirmed baseline, spawned a separate fix task.
Maestro pending device.
