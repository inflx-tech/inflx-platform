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
