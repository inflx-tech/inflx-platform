# Workflow — Phase 2 banner hide-when-empty

## W1 — One banner, three contexts
1. Admin authors ONE library rule ("Kurtis under ₹300") and places the same
   banner on Home, Creator Store, and Business page scopes.
2. Home (any follower): banner shows iff ANY live pushed product matches.
3. Charvitha's business page (has kurtis ≤ 300): banner shows.
4. UrbanThread's business page (no kurtis): banner ABSENT — not an empty shell.
5. A creator promoting no matching allocation: banner ABSENT on their store.

## W2 — Dry and dead rules
1. A banner whose rule matches nothing anywhere: absent everywhere.
2. Admin deletes/hides the library rule behind a placed banner: the placement
   disappears from the app (previously: empty ghost tiles section).

## W3 — Static frames unaffected
Static image frames (rule='static', images in config.tiles, items always [])
render exactly as before on every page.
