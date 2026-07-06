# Workflow — Phase 3 World Rules

## W1 — Ship is inert
Deploy backend + admin with the table empty: every world behaves byte-identically
(rank_only legacy). Proven by the suite's "absent settings row" test.

## W2 — Flip food to Boundary (3c)
1. Admin opens World Settings → food → Location: Boundary, Radius: e.g. 10 km,
   If empty: Show empty → Save. Live ~60s.
2. Hyderabad follower, Food tab: Vijayawada restaurants GONE (with GPS: radius;
   without GPS: city match). Vijayawada follower: unchanged.
3. Fashion tab (no row saved): unchanged everywhere.

## W3 — Empty-area fallbacks
Follower in an area with nothing inside the radius:
- show_empty → honest empty shelf; widen → one retry at 2× radius;
- show_nearest → unbounded retry (nearest first).

## W4 — Curation surfaces immune
With food = Boundary, a follower far away opening a specific restaurant's
business page (e.g. via share link) still sees its full page; creator stores
likewise never radius-gate their allocated products.

## W5 — Reset
"Reset to default" deletes the world's row → legacy rank_only immediately.
