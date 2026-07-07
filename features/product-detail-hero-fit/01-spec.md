# Product detail hero — show the whole photo (stop cropping the top)

**Reported by founder 2026-07-06 (screenshot):** after the card fix, product
cards look right, but the product DETAIL page crops the top of the image (the
model's head is cut off).

## Root cause

`ProductDetailScreen` hero was a **fixed 332px near-square box**
(`hero: { height: 332 }`, full screen width) with `resizeMode="cover"`. A
portrait product photo (measured 494×741, 2:3) covered into a ~square box is
scaled to fill the width and the tall overflow (~104px top + ~104px bottom) is
cropped → head and feet sliced. Pre-existing behaviour, now visible because
real portrait images finally render (image-resolution + photos-first). The
card fix did NOT touch this screen.

## Fix (mobile, OTA)

- Hero box: `height: 332` (near-square) → `width: 100%, aspectRatio: 3/4`
  (portrait, ~image-dominant), keeping `overflow: hidden`.
- Hero image: `resizeMode` `cover` → **`contain`** so the ENTIRE photo shows;
  the pale (accent) background fills any letterbox margin.
- Result: full model shot visible, no top/bottom crop; the horizontal
  swipe carousel + dots are unaffected (width unchanged, still HERO_W-paged).

## Out of scope

The product card (shipped separately, follower v183), FoodDishCard, the
"more products" thumbnails (stay cover — small tiles). No backend change.
