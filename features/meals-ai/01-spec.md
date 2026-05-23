# meals-ai — AI services + AI-eval lane (X1 + X2)

> **Phase X1 + X2.** The Anthropic Claude integration for INFLX Meals,
> wrapped in `backend/src/services/ai/` (NOT a separate service — it
> stays inside the governance OS), plus the new **AI-eval test lane**.

## X1 — AI services
- `ai/mock.js` — deterministic rule-based extractor + recommender
  (used when `AI_MOCK` or no key; also the eval baseline).
- `ai/client.js` — Anthropic client (lazy SDK). **Tool-use forced JSON**
  for intent extraction; **prompt caching** (`cache_control`) on the
  static system + memory blocks; Haiku-class for extract/clarify,
  Sonnet-class for ranking.
- `ai/index.js` — dispatcher: mock vs live, with a safe fallback to
  mock on any AI error (a model outage never breaks ordering).
- **AI returns STRUCTURE only** (intent / clarify / ranking) — every
  rupee comes from the deterministic engine (P3).
- Wired as `POST /meals/chat`: extract intent (pre-filled from the
  customer's remembered preferences), ask ONE meaningful follow-up only
  for a blocking missing field, else persist the intent → engine
  offers → AI recommendation. No-match → simple message (decision 2).
- Env: `AI_MOCK` (default true), `ANTHROPIC_API_KEY`, `AI_MODEL_EXTRACT`
  (Haiku), `AI_MODEL_REASON` (Sonnet) — key never committed.

## X2 — AI-eval lane (NEW testing primitive)
- `qa/ai-eval/golden-intents.json` — golden chat→intent cases with
  expected fields + clarify expectation.
- `qa/scripts/ai-eval.mjs` (`pnpm qa:ai-eval`) — field-level,
  tolerance-scored; **INFORMATIONAL, always exit 0** (like `qa:db`,
  never gates the main GREEN). Scores `ai/mock.js` locally; scores the
  live model when `AI_MOCK=false`.

## Success
`backend/tests/meals-x1.test.js` green (clarify / offers+recommendation
/ no-match); `pnpm qa:ai-eval` runs and reports a healthy pass rate;
`pnpm qa` GREEN (zero regression). Real `@anthropic-ai/sdk` install is a
prod-deploy prerequisite (lazy-required; not needed for mock/tests).
