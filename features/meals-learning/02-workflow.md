# meals-learning — workflow

## Build
1. `mealsLearning.service.js` — `recordRuleStatusChange` +
   `upsertCustomerPrefsOnOrder` + `rejectedReasonTag`.
2. `meals.service.updateOfferRule` — transactional, captures prev
   status, writes learning row on transition (failure-safe).
3. `meals.service.lockAndPay` — calls customer-prefs upsert in the
   order transaction (failure-safe).
4. Test `meals-learning.test.js`.

## Test
- `cd backend && npx jest tests/meals-learning.test.js --runInBand` → green.
- All meals backend suites green; `pnpm qa` web lane green.

## Expected end state
- Every Accept/Reject lands a learning row; the next AI suggestion
  prompt receives those learnings as memory.
- Every paid order updates the follower's preference row; the next
  chat's recommendation reasoning references the remembered budget +
  spice (round-trip proved by the third test).
