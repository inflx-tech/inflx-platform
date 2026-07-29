# 03 — Expected outputs

## Large tiles — all 3:4 + cover

| Surface | Component | Before | After |
|---|---|---|---|
| Brand store | `ProductCard` hero | `height: 130` (~54% of frame kept) | `aspectRatio: 3/4` |
| Category list | `ProductCard` hero | same component | same fix |
| Saved | `SavedScreen` `img` | `height: 150` | `aspectRatio: 3/4` |
| Wishlist | `WishlistScreen` `cimg` | `height: CARD_W * 1.2` | `aspectRatio: 3/4` |
| Post gallery | `PostProductScreen` | `W × W * 1.1` | `W`, `aspectRatio: 3/4` |
| Shop-this-post | `ShopThisPostSheet` `img` | `aspectRatio: 4/5` | `aspectRatio: 3/4` |

`resizeMode="cover"` is present as a **prop** on every one of these
after the change. `SavedScreen` was the only site in the app declaring
it inside a StyleSheet; that is corrected.

## Supporting changes required for the above to actually work

- `SavedScreen` `imgWrap`: `height: 150` removed — otherwise it clips
  the new 3:4 child.
- `SavedScreen` `imgPh`: `flex: 1` → `width: '100%'` +
  `aspectRatio: 3/4`, or the no-image placeholder collapses to zero
  height once the wrapper is unpinned.

## Small thumbnails

| Screen | Before | After |
|---|---|---|
| `ReviewOrderScreen` `ith` | 42 × 52 | 42 wide, `aspectRatio: 3/4` → 56 |
| `OrderHistoryScreen` `thumb` | 52 × 64 | 52 wide, `aspectRatio: 3/4` → ~69 |
| `CartScreen` `thumb` / `recImg` | 54×54 / 104×104 | **unchanged** |

Both changed thumbs already passed `resizeMode="cover"`; only the box
differs.

## Unchanged by design

- `ProductDetailScreen` hero — still `contain`.
- `ShelfProductCard`, `CategoryBrowserScreen`, `SectionResultsScreen` —
  already 3:4.
- Cart.

## Regression bar

`pnpm qa` green. No backend, no schema, no API change — this is
styling only, in `Packages/Mobile/src/**`.
