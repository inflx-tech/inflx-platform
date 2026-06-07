# Impact — Add-menu cuisines + location mock-off

## Terse verdict
**Two targeted fixes, low blast radius.** Location: prod stops faking every restaurant to
Vijayawada (real coords from the pasted link). Add-menu: a returning brand can actually add
dishes (saved cuisines load) and manage cuisines in the menu surface — no business-setup
trip. No migration, no follower/admin change.

## Mechanics
- **Mock-off** is a one-line default flip (opt-out → opt-in). No test depended on the old
  default (grep verified). Prod auto-corrects on deploy. Caveat: if prod has an explicit
  `GEOCODING_MOCK=true` Render env var, that must be removed (operator) — but the symptom
  matches the default, so the code flip should fix it.
- **Cuisine sourcing** adds a fallback to `brand.listing_data.cuisines` + a union with
  session-added cuisines. First-time wizard unaffected (listing_data empty there; the
  in-session value drives it).
- **Add-cuisine** persists via PATCH /brands/me (non-blocking) and reuses already-loaded
  master dishes — no new endpoint.

## Risk / rollback
- Revert the commit. Add-cuisine failure is non-blocking (local state still works).
- The "Category" sub-nav label already matches the founder's wording (section grouping).
