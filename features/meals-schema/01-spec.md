# meals-schema — INFLX Meals data foundation (P0)

> **Phase P0 of the INFLX Meals program.** This contract is the
> Postgres schema only — no API, no UI, no AI. It lays the tables the
> later phases (P1 vertical slice → P6 learning) build on. Backend-
> governed (`backend/migrations/`), production-impacting, gated on
> explicit founder go before any push.

## What INFLX Meals is (recap, from the locked design)
A restaurant-only **planned-meal marketplace** layered on INFLX, with
its **own money/data model separate from the influencer commission
spine** (it reuses `brand_products`, the restaurant store, follower
app + notifications, but NOT `campaign_offers`/`follower_transactions`).
Customers order ahead; orders close ~2h before the meal; restaurants
self-deliver within ~5 km. **AI suggests/understands; deterministic
code computes every rupee; the owner sets prices.**

## Goal of this phase
Create the schema that holds: per-restaurant Meals config + slots,
deterministic offer rules, the customer intent→offer→order chain, and
the Postgres-resident memory the (stateless) LLM is fed from. No
behaviour ships — `git push` of this migration only adds tables.

## Tables (all `uuid` PKs, money in RUPEES `numeric`, `updated_at`
triggers reuse the existing `update_updated_at()` function)

### Core (6)
1. **restaurant_meal_config** — one row per restaurant (`brand_id`
   unique). `enabled`, `delivery_radius_km`, `max_discount_pct`,
   `never_below_cost`, `auto_offer`, `discount_clock` (jsonb array of
   `{unit,n,pct}` — the *editable* discount-clock setting from mockup
   01), timestamps.
2. **meal_slots** — recurring slot definitions per restaurant
   (`brand_id`). `label` (Lunch/Dinner), `serve_time`,
   `cutoff_minutes_before`, `capacity`, `days_active` (jsonb),
   `is_active`. Date-specific order-book fill is derived from
   `meal_orders` (slot_id + slot_date) — no per-day instance table.
3. **meal_offer_rules** — deterministic offer definitions (standing
   offers, AI-accepted ideas, and "create-your-own plain-English"
   offers). `brand_id`, `name`, `party_size` (enum), `offer_kind`
   (enum), `items_json`, `base_price`, `discount_type`,
   `discount_value`, `freebies_json`, `photo_url`, `slot_id?`,
   `custom_description` (the plain-English source), `trigger_json`
   (e.g. weather/radius constraints), `source` (ai/custom/template),
   `status` (enum), `accepted_at`, `rejected_reason`, timestamps.
4. **meal_intents** — what a customer asked for (chat or browse).
   `follower_id?`, `brand_id?` (chat may be cross-restaurant),
   `party_size`, `veg_count`, `nonveg_count`, `items_json`,
   `spice_level`, `occasion`, `drop_location` (jsonb),
   `slot_date`, `slot_label`, `budget_per_head`, `raw_text`,
   `parsed_json`, `status` (enum), timestamps.
5. **meal_offers** — the concrete ranked shortlist presented for an
   intent. `intent_id`, `brand_id`, `offer_rule_id?`, `items_json`,
   `price`, `original_price`, `freebies_json`, `eta_text`, `rank`,
   `ai_recommended`, `reasoning`, `status` (presented/selected/
   expired), timestamps.
6. **meal_orders** — locked + paid orders. `meal_offer_id`,
   `intent_id?`, `follower_id`, `brand_id`, `slot_id?`, `slot_date`,
   `party_size`, `items_json`, `amount`, `commission_pct`,
   `commission_amount` (platform revenue — separate from influencer
   commission; exact rate set in P-REV later), `delivery_address`
   (jsonb), `distance_km`, `status` (enum), `cutoff_at`, `paid_at`,
   timestamps.

### Memory (3 — LLM is stateless; backend assembles prompts from these)
7. **meal_restaurant_learnings** — owner-confirmed money facts +
   AI-inferred appetite. `brand_id`, `brand_product_id?`,
   `learning_type` (cost/floor/discount_appetite/freebie_willingness/
   rejected_reason/standing_note), `key`, `value_json`, `confidence`,
   `owner_confirmed` (money facts are owner-confirmed, never AI-
   guessed), `source`, timestamps.
8. **meal_customer_preferences** — one row per follower
   (`follower_id` unique). `spice_pref`, `veg_pref`,
   `budget_per_head`, `favourite_brand_ids` (uuid[]), `cuisines`
   (text[]), `prefs_json`, timestamps. AI-inferred is OK here.
9. **meal_conversations** — short-term chat state. `follower_id`,
   `brand_id?`, `state_json`, `last_intent_id?`, `status`, timestamps.

### Enums
`meal_party_size` (single/duo/trio/family/office) ·
`meal_offer_kind` (discount/free_addon/mixed/early_order/custom) ·
`meal_offer_status` (suggested/accepted/rejected/active/archived) ·
`meal_intent_status` (open/clarifying/offered/ordered/no_match/
abandoned) · `meal_presented_status` (presented/selected/expired) ·
`meal_order_status` (pending_payment/paid/locked/frozen/preparing/
out_for_delivery/delivered/cancelled/refunded).

## Out of scope (later phases)
API endpoints, services, AI integration, the deterministic engine,
mobile/web UI, the exact commission rate, seed data. This is tables
only.

## Non-negotiables
- Reuses `update_updated_at()`; FKs to `brands(id)`, `followers(id)`,
  `brand_products(id)`, `meal_slots(id)` — all `uuid`.
- Money columns RUPEES `numeric` (migration-021 rule).
- Migration is **idempotent** (`IF NOT EXISTS`; enums wrapped in a
  `DO $$ … duplicate_object … $$` guard) so it composes cleanly in
  the full-order re-apply (`dev-db-init` / `qa:db` setup).
- Additive only — no change to existing tables, so zero regression.
