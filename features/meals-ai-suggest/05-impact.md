# meals-ai-suggest — impact

## Blast radius
- Backend: additive — one new endpoint + one new service fn + AI
  mock/client/index extensions. No existing route/table touched.
- brand-web: an AI block + button in the Meals Setup tab (additive);
  no existing UI changed.

## Behaviour change
- New: pressing "Generate AI suggestions" inserts AI-authored
  combinations as `status='suggested'`. The lifecycle from P2
  (Accept / Modify / Reject) handles them; nothing else moves until
  the owner Accepts.
- AI never sets prices — the backend's joined `brand_products.price`
  + the restaurant's discount-clock are the only price authorities.

## Regression risk
- Low. Endpoint is brand-only and additive; the existing Setup tab
  cards keep rendering regardless of suggestions. `pnpm qa` green
  confirms the web lane is unchanged.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**` + `Packages/brand-web/app/**`).
  **Not pushed** — bundled into the single end-of-program prod push.
- **Deploy prereqs for the LIVE intelligence**:
  1. `npm i @anthropic-ai/sdk` in `backend/`.
  2. Render env: `ANTHROPIC_API_KEY=...`, `AI_MOCK=false`.
  Without them prod still runs (mock combiner), but loses LLM nuance.
