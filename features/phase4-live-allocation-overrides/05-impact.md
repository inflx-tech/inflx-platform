# Impact — Phase 4a+4b

**Verdict: two intended follower-visible corrections + one opt-in admin knob.
No migration, no OTA (backend + admin web only).**

- 4b live allocation CHANGES what creator stores show for store/category-
  scoped offers: from zero listed products (scope was ignored; arrays empty)
  to the correct live set. That is the intended fix — those offers were
  authored as "entire store"/"category" by the brand. Hand-picked offers are
  byte-identical. Coupon resolve goes from guaranteed-500 to working.
- 4a is opt-in: no section has world_rules_override until an admin sets one;
  engine merge returns the world default untouched when absent (world-rules
  suite re-proves all Phase 3 behaviours).
- Perf: live scopes swap a JSON union for one indexed brand_products query
  per offer render — bounded by offers-per-creator; no N+1 beyond the
  existing per-offer loop.
- Prod data note: section_config still empty in prod; 4a invisible until
  sections exist. 4b affects creator store pages immediately for any live
  store/category-scoped campaign offers.
