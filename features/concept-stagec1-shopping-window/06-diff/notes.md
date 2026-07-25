# Before/after — concept-stagec1-shopping-window

## Post viewer
- Before (Stage A): white-canvas screen — header bar, creator row block,
  carousel section, yellow shop bar below the media.
- After (C1 board): immersive black canvas; TRUE image full-height; all
  chrome floats over the photo (creator+Follow top, rail right, title/
  caption/count/dots/WHITE pill bottom). The concept name moved from the
  header into the bottom title — exactly the reference.

## Shop sheet
- Before: vertical LIST rows, tap row → legacy ProductDetail.
- After: 3-column GRID; corner bag buttons quick-add (inline size picker
  for sized products, dark=in-bag), black toast + yellow View Bag; image
  tap → the NEW PostProduct screen; sheet state survives the round trip.

## Product details (new screen)
- Before: posts landed on the legacy multi-path ProductDetailScreen.
- After: purpose-built board-exact PDP — effective price + struck list +
  deep-yellow % OFF, colour/size chips, accordion, live-offer lines,
  outline Add-to-Bag ("Go to Bag" after) + yellow Buy Now. No rating row
  (founder: only real data, behind an admin knob).

Capture note: device screenshots on founder verify, per program precedent.

## Design v3 (founder pixel-pass, board post-design-v3.html = the lock)
Mapping corrected: ref 1 = FEED, ref 2 = FULL-SCREEN. Implemented exactly:
- Icon system (react-native-svg): bold WHITE bag in black circle for pins/
  CTAs, outline heart/comment/share/save, blue verified tick (real data
  only). ALL colourful emoji purged from post surfaces.
- Feed card: ring avatar w/ initial fallback, black handle + tick, CREAM
  media sheet, WHITE shop pill INSIDE media (yellow bar retired), slide
  counter + blue-active dots, outline engagement row w/ counts, caption
  more/less, grey timestamp.
- Full-screen: whole canvas cream, back + ⋯ only, true-image slides w/
  pins, BLACK right rail w/ counts BELOW icons, bottom creator row +
  BLACK Follow (founder addition; ref's blue mark = the verified tick),
  caption + timeago, white "Shop this post / View all N products in this
  look ›" banner, comment bar (visual until comments ship).
- Backend: feed/detail creator payloads now carry `verified`.
- Canva rule recorded: cream comes from the APP canvas; creator images
  never tinted; composer tip suggests #F5F2EC export.

## v3.1 (founder device pass, 7 fixes)
1 pins bigger (icon 26-30, name 12, price 13 bold). 2 colour inversion
corrected: app chrome PURE WHITE everywhere; cream lives only in the feed
media sheet + creator-export backgrounds (never tinted). 3 bag icon redrawn
to the reference (solid rounded bag + arc handle) everywhere. 4 shop sheet
grid 3->2 columns, cards ~2x, bigger type. 5 close-X fixed (backdrop and
sheet are siblings now; the old touch-wrapper ate the tap on Android) +
hitSlop. 6 sheet opens INSTANTLY with a spinner (feed used to fetch first —
that was the perceived delay). 7 full-screen media = edge-to-edge COVER
fill, no letterbox separation ("one single fully covering post" — founder
overrides the earlier true-image rule); rail icons sit on white chips for
readability over photos.

## v3.2 — pin edge fix (founder single-item pass, 2026-07-25)

Before: a pill near the right screen edge ("Allen Solly Cot… ₹773") was
clipped — position used a guessed percentage clamp (x 14–86%) plus a fixed
translateX(-36), which can't know how wide the pill actually rendered.
After: the Pin measures its own width (onLayout) and clamps its absolute
left to [8, screen − width − 8] — at the right edge the pill slides left
of the tag point and is always fully visible; elsewhere behaviour is
unchanged. First frame renders at opacity 0 until measured (no jump).
One shared component, so feed card and full-screen viewer both fixed.
