# 04 — Workflow prediction

Stated before the diff is captured. This is a **Mobile** change, so
the real verification is on a device, not in Playwright.

## The one screen to look at first

**A brand's own store page**, with a full-length garment photo.

- **Before:** head and feet cut off — roughly the middle half of the
  frame, rendered as a torso strip.
- **After:** the whole uploaded photo, framed exactly as the brand
  cropped it.

If that screen looks unchanged, the fix has not loaded — it is the
most visually obvious of the seven.

## Then, the same product across surfaces

Open one product from brand store → category list → saved → wishlist →
a post's product gallery → the Shop-this-post sheet.

**Predicted:** identical framing on all six. Today they are six
different crops of one asset.

## Tiles get taller

Every large tile grows vertically — a 3:4 box is taller than the fixed
heights it replaces. Grid rows will shift down and fewer cards fit per
screen. That is the intended trade: the photo is no longer sliced.

## Placeholders

On Saved and Wishlist, a product with no image should occupy the same
3:4 box as a real photo, keeping rows level.

**Watch Saved specifically.** Its placeholder previously relied on
`flex: 1` inside a fixed-height wrapper. If the empty tile collapses to
a thin strip, that fix did not take.

## Small thumbnails

Review-order and order-history thumbs are ~4px taller. Genuinely hard
to see — worth a glance only to confirm nothing overflows its row.

**Cart is unchanged.** If cart rows look taller, something was edited
that should not have been.

## Explicitly NOT predicted

- **Product detail looking different.** Its hero still uses `contain`
  on purpose. An un-cropped image must not be sliced there.
- **Un-cropped images suddenly fitting.** Paste-URL, Excel, photo-tray
  and mobile-gallery uploads still bypass the 3:4 crop; a square or
  landscape photo will now be centre-cropped to 3:4 on the large
  tiles. That is the same `cover` behaviour every other tile already
  had, not a regression — but it is why the detail-screen safety net
  stays.
- **Any change on home shelves, the browse grid or the see-all grid.**
  Those were already 3:4 and were not touched.
- **Anything visible on web.** `pnpm qa` covers brand-web; here it is
  a no-regression check, not proof of the visual outcome.
