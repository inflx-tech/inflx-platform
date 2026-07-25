# concept-stagec1-shopping-window — Stage C1: the shopping window

**Program:** STAGE_C_DESIGN.md build order C1 · **Board (founder-locked, "pls
start implement"):** 04-preview/mockups/c1-shopping-window.html — the founder's
spec-1 reference layouts repainted to the locked canvas (pure white, black
type, minimal yellow).

## Goal (functional)
The exact 5-step reference journey: full-screen post → grid product sheet →
quick add-to-bag with toast → product details → back preserves the sheet.
Zero new backend — every payload already serves (post detail w/ live pins +
tracking; offer-aware PDP; CartContext rails).

## Built
- **PostViewerScreen (immersive rewrite):** TRUE image on black (Model B —
  contain, never cropped), overlays: back + creator row (avatar/handle/
  city/time-ago) + Follow pill (idempotent follow/unfollow, login guard) +
  share; Reels right rail (like/save live, comments/share coming soon);
  bottom-left concept/collection name as TITLE + caption (more/less) +
  "N PRODUCTS" + dots + WHITE Shop-this-post pill. Pins per tag style.
  Back-from-product REOPENS the sheet (focus listener + reopen ref).
- **ShopThisPostSheet (grid rewrite):** 3-column grid, corner bag button =
  QUICK-ADD (sized products open an inline size picker; button flips dark
  once in bag via cart lookup), name-with-dots + BOLD price + struck
  effective price, unavailable dimmed, black toast w/ yellow "View Bag"
  (→ Cart). Adds carry the post's tracking + creator handle → commission
  rails (cartKind 'shop', multi-brand safe).
- **PostProductScreen (new):** gallery (colour images > cover_images > card
  image) w/ dots · name · brand + "via @creator" · effective price + struck
  list + % OFF (deep yellow) · tax line · colour/size chips (stock-aware)
  · Product Details accordion (description + return days) · live-offers
  list (all 5 types from the PDP payload) · black-outline Add to Bag
  (flips "Go to Bag") + yellow Buy Now (add + jump to bag; the full
  review-order/payment flow is C3). Rating row ABSENT until real reviews +
  admin knob (founder decision).
- Legacy ProductDetailScreen untouched (old-app paths); unification in C3.

## Non-goals (later slices)
Bag page redesign (C2) · wishlist (C2) · review-order/payment/COD (C3) ·
orders lifecycle (C4) · pin-tap opening the sheet (with founder's tap spec).
