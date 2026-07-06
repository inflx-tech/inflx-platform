# Workflow — Phase 4a+4b

## W1 — live whole-store allocation (4b)
1. Charvitha allocates an "entire store 20% off" offer to Nisha (scope='store'
   — the option that already exists in the offer builder).
2. Nisha's creator store lists ALL of Charvitha's pushed products.
3. Charvitha pushes 15 new kurtis next week → they appear in Nisha's store
   with no re-save, no re-allocation.
4. Charvitha un-pushes a product → it leaves Nisha's store (Phase 0 rule).

## W2 — live category allocation (4b)
Same offer with scope='category' (e.g. 'Kurtis'): only that section's pushed
products, kept live as the section grows.

## W3 — hand-picked stays frozen (4b)
scope='products' with picked IDs: new products never leak in. Legacy
behaviour byte-preserved for bogo/bundle/absent-scope configs.

## W4 — coupon door works (4b defect fix)
Follower types Nisha's coupon code at cart → 200 with the creator +
live-allocated products (previously: guaranteed 500, column doesn't exist).

## W5 — one shelf, its own location rule (4a)
Fashion world = rank-only. Admin adds a "Stores near you" Shops row and sets
Rule options → Location = Boundary, Radius = 15. That one shelf shows only
shops within 15 km; every other fashion shelf keeps the world default.
Clearing the select back to "World default" reverts.
