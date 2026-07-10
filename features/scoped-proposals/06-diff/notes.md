# Before / After — Scoped, theme-aware proposals (Phase 8)

## 8a (built, backend — web/API-verifiable) — this pass
**Before:** proposals are campaign-level only; acceptance creates a mini-campaign.
**After:** proposals carry store/category/product scope + a theme; on accept an
experience draft is seeded (best-effort).

### End-to-end proof (local DB)
- Scoped proposal created: `scope=product · theme=street_style · products=4`.
- `seedFromProposal` → a **draft** experience: `theme=street_style`, `template=(none)`
  (no placed street_style template in dev → template-less draft, finish in Studio —
  the locked decision), `source_proposal_id` linked, `status=draft`, 4 products.
- Store-browse gate: **FORBIDDEN** when the brand isn't accepting proposals;
  returns products when it is.
- Full `pnpm qa` 95/95 green (one transient prod-network flake on an unrelated
  api spec — re-run green — classified environmental, not a regression).

### What matches the intent
- `influencer_proposals` +4 nullable cols (scope_level / scope_ref_json / theme_key
  / proposed_product_ids); `creator_experiences.template_key` loosened to nullable.
- Creator store-browse API (`/discover-brands/:id/products`, gated).
- `create` accepts the new (optional) fields; unscoped proposal = today's behavior.
- Accept path calls `seedFromProposal` **best-effort** (own try/catch) → a seed
  failure NEVER blocks the accept (campaign still created, proposal still accepted).

## 8b (next) — mobile
`SendProposal` gains browse-products + scope + theme; jest now, Maestro batched.

## Safety
Additive; the live accept flow is unchanged for a plain proposal, and even a
scoped one accepts identically if seeding is skipped/failed.
