# 06 — Before / after notes

Seven files under `Packages/Mobile/src/`. Styling only — no logic, no
props changed other than adding `resizeMode`.

## 1 · `components/cards/ProductCard.js` — the big one

`hero`: `height: 130` → `aspectRatio: 3 / 4`.

One component, two screens: `BrandStoreScreen.js:503` and
`CategoryListScreen.js:422`. Both parents supply `width: '48%'`
(`BrandStoreScreen.js:885`, `CategoryListScreen.js:709`) — verified,
so `aspectRatio` has a definite width to resolve against.
`heroImage` already carried `resizeMode="cover"` as a prop.

## 2 · `screens/follower/SavedScreen.js` — three coordinated edits

The line reference named only `img`, but two siblings had to move with
it:

- `imgWrap` — `height: 150` **removed**. Left in place it would have
  clipped the new 3:4 child.
- `img` — `height: 150` → `aspectRatio: 3 / 4`, and `resizeMode`
  **removed from the StyleSheet** and passed as a prop on the `Image`.
  This was the only site in the app declaring it in style.
- `imgPh` (no-image placeholder) — `flex: 1` → `width: '100%'` +
  `aspectRatio: 3 / 4`. `flex: 1` collapses to zero height once the
  wrapper is unpinned, so without this the empty tile would silently
  disappear.

## 3 · `screens/follower/WishlistScreen.js`

`cimg`: `height: CARD_W * 1.2` → `aspectRatio: 3 / 4`. The style is
shared by the `Image` and its placeholder `View`, so both stay in
step.

## 4 · `screens/follower/PostProductScreen.js`

Gallery item: `{ width: W, height: W * 1.1 }` →
`{ width: W, aspectRatio: 3 / 4 }`. Already had `resizeMode="cover"`.
This is a second product gallery, separate from `ProductDetailScreen`;
they now agree.

## 5 · `components/posts/ShopThisPostSheet.js`

`img`: `aspectRatio: 4 / 5` → `3 / 4`, and `resizeMode="cover"` added
to the `Image`, which had none. Style is shared with the placeholder
`View`.

## 6 · `screens/follower/ReviewOrderScreen.js`

`ith`: `42 × 52` → `width: 42, aspectRatio: 3 / 4` (≈56 tall).

## 7 · `screens/follower/OrderHistoryScreen.js`

`thumb`: `52 × 64` → `width: 52, aspectRatio: 3 / 4` (≈69 tall).

Both expressed as `aspectRatio` rather than a new hard-coded height,
so the shape is declared once. Both already passed
`resizeMode="cover"`.

## Founder decision recorded

Small thumbnails were split into two groups rather than treated as
one, because they are not equivalent: Review-order and Order-history
were already ≈0.81 (a ~4px change), while Cart is genuinely square
(54→72 and 104→139, visibly taller rows).

**Decision: fix the two near-3:4, leave Cart square.**

## Confirmed untouched

`git status` over the do-not-touch list returned clean:
`ShelfProductCard.js`, `CategoryBrowserScreen.js`,
`SectionResultsScreen.js`, `ProductDetailScreen.js` (keeps `contain`
as the safety net for un-cropped uploads), and `CartScreen.js`.

## Not captured as screenshots

This is a React Native change; the before/after only exists on a
device or emulator, and Playwright cannot reach it. Capturing it via
Maestro would mean a device run, which the standing rule defers to the
founder's single combined end-to-end pass.

The mockup at `04-preview/mockups/product-image-shape.html` renders the
crop loss directly — a full-length figure drawn against the true 3:4
frame, then clipped by each of the old boxes, so the ~54% loss on the
brand-store tile is visible rather than described.

## QA

`pnpm qa` — brand-web only, so this is a no-regression check rather
than proof of the visual outcome. Result recorded in `lock.json`.

## Deploy

Mobile runtime → **OTA bundle**, not a plain push. `git push` changes
nothing for users. `release.released` stays `false`, so no Maestro
gate applies yet.
