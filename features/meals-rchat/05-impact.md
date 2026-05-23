# meals-rchat — impact

## Blast radius
- Backend: one new endpoint + one service fn + AI mock/client/index
  extensions. No existing route/table touched.
- brand-web: the existing "Create your own offer" box is upgraded
  from a form to a chat input that calls the new endpoint. No other
  UI changed.

## Behaviour change
- The Setup tab's "Create your own" path now goes through AI:
  - Owner types a description → AI parses → either clarifies (one
    meaningful question) or builds a `status='suggested'` rule with
    items priced from `brand_products`.
  - The lifecycle (Accept / Modify / Reject) from P2 + P-AI-INTEL
    handles the result; nothing else moves until Accept.

## Regression risk
- Low. New endpoint is brand-only and additive; the create-your-own
  form code path is replaced with one that produces the same kind of
  row (suggested rule, owner reviews). `pnpm qa` green confirms the
  web lane is unchanged elsewhere.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**` + `Packages/brand-web/app/**`).
  **Not pushed** — bundled into the single end-of-program prod push.
- **Deploy prereqs (same as P-AI-INTEL)**: `npm i @anthropic-ai/sdk`,
  `ANTHROPIC_API_KEY`, `AI_MOCK=false`. Without them prod still runs
  (deterministic mock).
