# Follower product card — portrait image box (stop cropping apparel)

**Reported by founder 2026-07-06:** in the follower product shelf, product
images are "half cut"; the product detail page shows them fine.

## Root cause (measured, not guessed)

`ShelfProductCard` (Packages/Mobile/src/components/vibe/ShelfProductCard.js)
rendered the image in a **154×104 landscape** hero box with
`resizeMode="cover"`. Brand product photos are **portrait** — measured live:
Adidas 494×741 (2:3), Roadster 556×741 (3:4). Cover fills the wide-short box
and crops the tall overflow → the garment's top/bottom (~half) is sliced. The
detail screen looks fine because its hero box is large/tall (cover shows the
whole portrait image). Food is unaffected — it uses FoodDishCard.

## Fix (mobile, OTA)

Change the card hero box from `height: 104` (landscape) to
`width: 100%, aspectRatio: 3/4` (portrait, ~205px on the 154 card) +
`overflow: hidden`, keeping `resizeMode="cover"`. Portrait product photos now
fill with negligible crop; the pale card background shows for any rare
non-portrait source instead of a hard cut. Non-food verticals (fashion,
furniture, beauty, car_rental) share this card and all benefit.

## Image-size guidance for brands (storefront-ready)

Upload product photos **portrait 3:4** — e.g. **1080×1440 px** — for a
zero-crop fill. 2:3 (e.g. 1000×1500) also fills well (~10% edge trim). Avoid
landscape/wide crops for apparel.

## Out of scope

FoodDishCard (works), the detail-screen hero (works). No backend change.
Ships via OTA; Maestro on-device verify owed (no device connected at build).
