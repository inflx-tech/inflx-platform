# Workflow — concept-stagec1-shopping-window

## W1 — The golden 5 steps (board exactly)
Feed → tap post → immersive viewer (black, true image, overlays, white pill)
→ "Shop this post 🛍" → grid sheet ("Products in this post · N items") →
tap a corner bag button → sized product shows the inline size row → pick →
black toast "✓ … added to bag · View Bag", button now dark → tap a product
IMAGE → PostProduct details (price truth + selectors + accordion) → Add to
Bag flips to "Go to Bag" / Buy Now jumps to the bag → back ‹ → the SHEET
REOPENS on the post, added buttons still dark.

## W2 — Attribution invariant
Every add (quick-add or PDP) carries the post's per-product tracking block +
creator handle into the cart claim — the same rails that already pay
commission. No new attribution code; verify a purchased line shows
via-creator claim in the existing cart/checkout.

## W3 — Honesty states
Unavailable products dim and don't add · out-of-stock sizes dim · anonymous
like/save/follow prompt login · dark post → the Stage-A unavailable state ·
no rating row anywhere (no data yet).

## Expected end state
mobile jest 25/25 · pnpm qa GREEN · gov 0 · OTA ships it (no backend, no
migration). Founder device-verifies the 5 steps on the Monsoon T-Shirt post.
