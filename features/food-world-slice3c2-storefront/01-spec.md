# 01 — Spec · 3C-2 Customise · Dish-detail · Storefront

The dish-ordering interaction. Mobile-only (backend ready from P1).

## Surfaces
1. **Customise popup** (bottom sheet, replaces the flat inline list in
   ProductDetailScreen): grouped from `getProductDetail.addon_groups` —
   the `is_variation` single-select group SETS the base price (Half/Full),
   `multi` add-on groups stack (+price, "select up to max_select", Select All),
   `is_required`/`min_select` enforced; qty stepper; live total = variation +
   Σ add-ons; "Add Item ₹X" → unified cart with {variation, selected_addons[], note}.
2. **Dish-detail popup** (bottom sheet, on image/name tap): big image, veg mark,
   price + struck MRP, brand rating, free-text description, ADD (→ customise if
   has_addons else direct add) + "Customisable" hint.
3. **Storefront reskin** (RestaurantDetailScreen, toing): header (name·rating·
   ETA·locality) · in-store dish search · veg/non-veg filter chips · collapsible
   category sections (brand_products.section) · floating MENU jump · free-delivery
   cart bar · dish rows with ＋ (→ customise/detail).

## Cart unification
RestaurantDetailScreen's separate local `useState` cart is replaced by the global
`CartContext`; the ＋/popup write a line carrying variation + add-ons + note. The
cart line_key includes a customisation signature so differently-built same-dish
lines stay distinct. (The cart SCREEN + offer-picker + organic-order enable +
place-order = 3C-3.)

## Backend
No change — `getProductDetail.addon_groups` + placeOrder server-side add-on
resolution shipped in Phase 1.
