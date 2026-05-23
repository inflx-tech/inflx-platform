# meals-schema — expected outputs

## After applying 056 to the local dev DB
- 9 new BASE TABLES present in `public`:
  `restaurant_meal_config`, `meal_slots`, `meal_offer_rules`,
  `meal_intents`, `meal_offers`, `meal_orders`,
  `meal_restaurant_learnings`, `meal_customer_preferences`,
  `meal_conversations`.
- 6 new enum types in `pg_type`:
  `meal_party_size`, `meal_offer_kind`, `meal_offer_status`,
  `meal_intent_status`, `meal_presented_status`, `meal_order_status`.
- Total table count: 56 → 65.
- All FKs resolve (`brands`, `followers`, `brand_products`,
  `meal_slots` self/cross refs).

## Test results to attach at phase close
- `pnpm dev:doctor` → ALL GREEN.
- one-shot apply log → every statement OK.
- `information_schema` probe → 9/9 tables, 6/6 enums present.
- `pnpm qa` → GREEN, same pass count as before (no regression).

## What this phase does NOT produce
No screenshots (no UI in P0). Evidence is the DB probe + qa output.
First screenshots come in P1 (the thin vertical slice has UI).
