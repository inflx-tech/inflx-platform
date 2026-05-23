# meals-learning — impact

## Blast radius
- One new pure module (`mealsLearning.service.js`).
- Two surgical edits in `meals.service.js`:
  - `updateOfferRule` wrapped in a transaction with `FOR UPDATE`
    prev-status capture and a failure-safe learning write.
  - `lockAndPay` adds a failure-safe customer-prefs upsert inside
    its existing transaction.
- No new endpoints. No UI change. No schema change (the tables were
  already in migration 056).

## Behaviour change (intentional)
- Every Accept on an offer rule with a discount/freebies now lands
  a `meal_restaurant_learnings` row; Rejects with a reason land a
  tagged `rejected_reason` row.
- Every paid order upserts the follower's `meal_customer_preferences`
  (favourite_brand_ids, rolling budget_per_head, spice_pref).
- Read-back is automatic via the existing chat prompt assembly.

## Regression risk
- **Very low.** All writes are wrapped in try/catch and must never
  fail the underlying user action (an Accept toggle or a pay). The
  transactional wrap on `updateOfferRule` adds a row-level lock but
  on a low-contention path. Existing meals tests stay green.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**`). NOT pushed — bundled into
  the single end-of-program prod push. Backend-only → gov-check
  Rule 1 only.
- No deploy prereqs of its own (uses what's already in place).
