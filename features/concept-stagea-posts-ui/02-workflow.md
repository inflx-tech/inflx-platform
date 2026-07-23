# Workflow — concept-stagea-posts-ui

## W1 — Browse
Follower opens the center tab → Posts feed: white full-bleed cards, creator
row + concept chip, cover at its natural clamped ratio with price pins,
yellow Shop bar, engagement row, 2-line caption. Empty prod today → the
honest empty state ("Creator posts land here the moment they're approved").

## W2 — Immerse
Tap a card → full-screen viewer: "Posts / <concept name>" header, true-ratio
slides with per-slide pins, right rail with live like/save counts, dots,
Shop bar, full caption. A dark/removed post → "Post unavailable" state with
the eligibility explanation.

## W3 — Shop
Shop bar (or card bar) → bottom sheet → products sorted concept-first with
effective prices → tap → the EXISTING ProductDetail (now offer-aware) with
tracking → add to bag → existing checkout → creator commission attributes
through the live rails. Unavailable products render dimmed, un-tappable.

## W4 — Engage
Like/save toggle optimistically with server counts; anonymous tap → login
prompt → FollowerLogin (existing). Comments/share → "coming soon".

## Expected end state
Mobile jest 25/25 (pre-existing wallet transform failure unchanged);
backend node --check green; pnpm qa GREEN; gov 0. Deploy = push (feed_pins
backend) + OTA all flavors; founder verifies on device (release.released
stays false until Maestro/device pass).
