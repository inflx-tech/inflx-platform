# Impact — Phase 2 banner hide-when-empty

**Verdict: one intended follower-visible behaviour change — rule-driven
banners disappear wherever their rule currently matches nothing (previously
they rendered as dead-end shells). Backend only; no migration, no OTA.**

- Cost: one extra rule execution at LIMIT 1 per banner placement per cache
  window, cached under `key:exists` with the engine's existing TTL — bounded
  and shared across followers in the same rounded-coords/city bucket.
- Kept banners are byte-identical on the wire (`banner_gateway`, `items:[]`)
  — zero client-compat risk; old and new mobile bundles both render them.
- Static frames untouched (drop conditions key on rule='library_products',
  never on empty items alone).
- Admin caveat (accepted): a hidden-here banner also disappears from the
  admin live-preview pane for that context — matches reality; an explicit
  "hidden — no matches" admin affordance is a later-phase candidate.
- Prod data note: section_config is currently EMPTY in prod (2026-07-06
  finding), so on deploy day this changes nothing until sections are rebuilt.
