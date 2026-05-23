# meals-ai — workflow

## Build
1. `backend/src/config/env.js` — `AI_MOCK` / `ANTHROPIC_API_KEY` /
   `AI_MODEL_EXTRACT` / `AI_MODEL_REASON`.
2. `backend/src/services/ai/{mock,client,index}.js`.
3. `meals.service.chat` + `getCustomerPreferences`; controller `chat`;
   route `POST /meals/chat`.
4. X2: `qa/ai-eval/golden-intents.json` + `qa/scripts/ai-eval.mjs` +
   `qa:ai-eval` script.

## Test
- `cd backend && npx jest tests/meals-x1.test.js --runInBand` → green.
- `pnpm qa:ai-eval` → prints pass rate, exit 0 (informational).
- `pnpm qa` → GREEN (web lane unaffected).

## Expected end state
The chat brain extracts intent (memory-aware), clarifies meaningfully,
and routes into the deterministic engine; the eval lane guards against
extraction drift. Deploy-inert until the single end-of-program push;
`@anthropic-ai/sdk` install + `AI_MOCK=false` + key set at deploy.
