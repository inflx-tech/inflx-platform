# meals-learning — learning loop writes (P6)

> **Phase P6.** Closes the memory loop. The READ side was already wired
> (chat() reads `meal_customer_preferences` and passes memory into
> prompts; `suggestOffersForBrand` reads `meal_restaurant_learnings`).
> This phase adds the WRITE side so the system gets smarter on every
> event — Accept / Reject / Modify on offer rules, and every paid order.

## What's locked
- **Owner-confirmed money facts** (cost / floor / discount appetite /
  freebie willingness) are written from the OWNER's actions only.
  AI-suggested rows never set `owner_confirmed=true` until the owner
  Accepts/Modifies them.
- **Restaurant learnings** (`meal_restaurant_learnings`):
  - Accept (suggested → active/accepted): `discount_appetite` row
    (party-size keyed, value_json = {base, discount_type, value,
    offer_kind}). If the rule had freebies: also `freebie_willingness`.
  - Reject (→ rejected) with reason: `rejected_reason` row, tagged
    (`thin_margin` / `too_many_freebies` / `wrong_quantities` /
    `wrong_dishes` / `discount_too_high` / `wrong_timing` / `other`),
    full text preserved in `value_json.full_text`.
- **Customer preferences** (`meal_customer_preferences`, one row per
  follower):
  - On paid order: upsert spice_pref (COALESCE-new-value),
    budget_per_head (rolling average of `amount / headcount`),
    favourite_brand_ids (set-union, no dupes), cuisines (set-union).
  - Headcount: single=1, duo=2, trio=3, family=4, office=12.

## Backend
- `backend/src/services/mealsLearning.service.js` — pure write helpers:
  `recordRuleStatusChange(tx, brandId, rule, prevStatus)`,
  `upsertCustomerPrefsOnOrder(tx, { followerId, order, intent })`,
  `rejectedReasonTag(text)`.
- `meals.service.updateOfferRule` — now transactional: `SELECT … FOR
  UPDATE` to capture previous status, then UPDATE, then write learning
  rows. Failure-safe (`.catch(() => {})`) so a learning write never
  fails the user action.
- `meals.service.lockAndPay` — after the order is inserted in the
  transaction, calls `upsertCustomerPrefsOnOrder` wrapped in try/catch
  (learning write must never fail an order).

## Read side
Unchanged — the prompt assembly in `chat()` already pulls
`meal_customer_preferences` into `memory` and passes it to
`ai.extractIntent` / `ai.recommendOffer`. The third test case proves
the round-trip: after two orders, the next chat's recommendation
reasoning references the customer's remembered budget + spice.

## Tests
- `backend/tests/meals-learning.test.js` (3/3):
  - Accept with freebies → both learning types written; second Accept
    on a plain-discount rule → only `discount_appetite`.
  - Reject with reason → `rejected_reason` row tagged correctly.
  - Two paid orders → favourite_brand_ids unioned (no dupes),
    budget rolling, spice persisted; the next chat's recommendation
    reasoning matches the remembered budget + spice.
