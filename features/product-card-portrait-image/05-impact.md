# Impact — product card portrait image

**Verdict: one mobile style change to the shared non-food product card. No
backend, no data, no migration. Reaches phones via OTA only (git push is
inert for devices).**

- Only `ShelfProductCard`'s hero box shape changes (landscape 104px →
  portrait 3:4). resizeMode stays `cover`; no prop/import/logic change.
- Taller cards (~205px image) in the horizontal rail — more vertical space per
  card; layout is a horizontal Rail so it accommodates naturally.
- Food (FoodDishCard) and the detail screen are untouched.
- Rollback = OTA republish of the prior bundle.
