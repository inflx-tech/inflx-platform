# meals-schema — impact

## Blast radius
- **Additive only.** No ALTER/DROP on existing tables, no data
  migration, no change to any existing query path. Existing app code
  is unaware of these tables until later phases wire them.
- New objects are namespaced `meal_*` / `restaurant_meal_*` so they
  cannot collide with existing names.

## Regression risk
- **Near zero.** Adding tables/enums does not alter existing
  behaviour. `pnpm qa` green confirms it. The full-order re-apply
  (`dev-db-init` / `qa:db` setup) confirms `056` composes after `055`.

## Production
- PRODUCTION-IMPACTING (a migration runs on Render → Supabase prod on
  push). **Surfaced for explicit founder go; never pushed silently.**
- Local-only until then (applied to `localhost:5433`).
- Rollback: drop the 9 tables + 6 enums — safe because nothing else
  references them yet.

## Forward dependencies (not this phase)
P-REV will set the real `commission_pct`; P1+ add services/AI/UI that
read+write these tables; P4 wires the store Offers tab + chat.
