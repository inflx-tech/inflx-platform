# 01 — Spec: follower-product-image-shape

Founder-authored contract. Unify the product-image shape across the
follower app.

## Problem

Brand product photos are cropped **once** at upload to 3:4 portrait
(900×1200 — `Packages/brand-web/lib/imageFrames.js`, `product_photo`).
The follower app then renders that single asset in ~6 different box
shapes, so the same photo is re-cropped differently on every screen.

Worst case is the brand's own store page, which keeps only the middle
**54%** of the frame: a full-length garment renders as a torso strip.

## Goal

Every **large** product tile renders at `aspectRatio: 3/4` with
`resizeMode: 'cover'`, matching the upload frame. Cropped once, looks
identical everywhere.

## Already correct — untouched

- `components/vibe/ShelfProductCard.js` (home shelves, creator store)
- `screens/follower/CategoryBrowserScreen.js` (browse grid)
- `screens/follower/SectionResultsScreen.js` (see-all grid)
- `screens/follower/ProductDetailScreen.js` — hero uses `contain`
  **deliberately**, as a safety net for images that never went through
  the crop. Left alone.

## Fixes (all verified against the working tree 2026-07-29)

| # | File | Now | After |
|---|---|---|---|
| 1 | `components/cards/ProductCard.js` `hero` | `height: 130` | `aspectRatio: 3/4` |
| 2 | `screens/follower/SavedScreen.js` `img` | `height: 150` + `resizeMode` in style | `aspectRatio: 3/4`, `resizeMode` as prop |
| 3 | `screens/follower/WishlistScreen.js` `cimg` | `height: CARD_W * 1.2` | `aspectRatio: 3/4` |
| 4 | `screens/follower/PostProductScreen.js` gallery | `W × W * 1.1` | `W`, `aspectRatio: 3/4` |
| 5 | `components/posts/ShopThisPostSheet.js` `img` | `aspectRatio: 4/5`, no `resizeMode` | `3/4` + explicit `cover` |

**#1 is the biggest single win.** `ProductCard` drives *both*
`BrandStoreScreen.js:503` and `CategoryListScreen.js:422`; both parents
supply `width: '48%'` (`BrandStoreScreen.js:885`,
`CategoryListScreen.js:709`), so `aspectRatio` resolves cleanly.

### Two things the line refs alone do not show

- **#2 has a second constraint.** `imgWrap` also carries
  `height: 150` (`SavedScreen.js:218-221`). Leaving it would clip the
  new `aspectRatio` child. And the empty-state sibling `imgPh` uses
  `flex: 1`, which collapses to zero once the wrapper loses its fixed
  height. Both must change with it, or the fix silently breaks the
  placeholder.
- **#3 and #5 reuse the same style object for the Image *and* its
  placeholder `View`.** Putting `aspectRatio` on the shared style keeps
  the two in step — desirable, and worth stating so it is not read as
  accidental.

## Founder decision — small thumbnails

Asked, because the contract said not to guess. They do not form one
group:

- `ReviewOrderScreen.js:356` (42×52) and `OrderHistoryScreen.js:150`
  (52×64) are **already ≈3:4** (0.81). Making them exact costs ~4px of
  height.
- `CartScreen.js:618, :666` (54×54 and 104×104) are genuinely square.
  3:4 would make the line-item thumb 72px and the cross-sell 139px —
  visibly taller rows.

**Decision: fix the two near-3:4 ones, leave Cart square.** Cart and
checkout row heights are untouched.

Both already pass `resizeMode="cover"`, so only the box changes. They
are expressed as `aspectRatio` rather than a new hard-coded height, so
the shape is declared rather than recomputed.

## Optional item — deliberately skipped

`CategoryBrowserScreen.js:623` and `SectionResultsScreen.js:149` hold
byte-identical copy-pasted tile styles. Extracting a shared component
would stop that drifting, but both screens are on the **do-not-touch**
list, and refactoring them would add a new component plus edits to two
already-correct screens for zero visual change. Noted for a follow-up
contract instead of widening this diff.

## Out of scope (separate contracts)

- Forcing paste-URL / Excel / photo-tray / mobile-gallery uploads
  through the 3:4 crop — they bypass it entirely today, which is
  exactly why `ProductDetailScreen`'s `contain` safety net stays.
- Thumbnails, derivatives and cache headers on
  `GET /media/assets/:id`.
