# design-system-p1-product-card — one clean 3:4 product card everywhere

## Founder (2026-07-08) — "ours looks amateur vs AJIO; big suspect is design"
Professional apps (AJIO/Myntra) look polished because of CONSISTENCY: one
product-image aspect, one card, one spacing/type rhythm. Ours mixed aspects per
screen → looked stitched-together, and the founder's careful crop didn't show as
set (card re-cropped it).

## Root cause (verified)
Product cards used THREE different image aspects:
- ShelfProductCard (rails): 3:4 ✅
- CategoryBrowser grid: fixed 122px landscape ✗
- SectionResults grid: fixed 110px landscape ✗
- Phase-1 cropper output: 4:5 ✗
None agreed → landscape boxes sliced portrait photos; the crop got re-cropped.

## Fix (Phase 1 of the redesign — the canonical card)
- **One product-image aspect = 3:4** everywhere.
- CategoryBrowser + SectionResults grid cards reskinned to match
  ShelfProductCard: 3:4 image, dark discount badge (ink + yellow), tidy
  brand(bold)/name(muted)/price(+struck), 14px radius, hairline border, soft
  shadow.
- Cropper/imageFrames `product_photo` → 3:4 (900×1200), so a crop displays
  exactly as set (crop-aspect == display-aspect).

## Non-goals (later phases)
Home/PDP/cart full reskin; design-token module; category images render. This
contract is the shared card + aspect only.

## Acceptance
Browse grid + view-all grid + rails all show clean, identical 3:4 cards; a
freshly cropped product photo shows as cropped. `pnpm qa` GREEN; mobile tests
pass; brand-web builds.
