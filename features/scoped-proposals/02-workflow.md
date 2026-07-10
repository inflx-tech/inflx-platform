# Workflow — Scoped, theme-aware proposals (Phase 8)

## 8a — proposal model + store-browse + acceptance seed (web/API-verifiable)

### Happy path (end state to prove)
1. Creator `GET /influencers/me/discover-brands` (existing) → brands accepting proposals.
2. Creator `GET /influencers/me/discover-brands/:id/products` → the brand's browsable products (gated: brand `accepts_proposals`).
3. Creator `POST /influencers/me/proposals` with the existing fields **plus** `scope_level:'product'`, `proposed_product_ids:[…]`, `theme_key:'street_style'`.
4. Brand accepts (existing path) → today's mini-campaign is created **and** a `creator_experiences` draft is seeded: theme_key + proposed products + `source_proposal_id`, binding a matching placed template if one exists (else template_key null, to complete in the Studio).
5. **End state (8a):** after accept, `creator_experiences` has a draft for the creator with the proposed products + theme + `source_proposal_id` — proven by unit + local DB. The existing accept flow is unchanged if seeding is skipped.

## 8b — mobile store-browse + product picker (mobile-governed)

### Creator (influencer app)
1. Discover → a brand → **Browse products** (grid, search).
2. Pick scope (whole store / a category / these products) + select products + a **theme**.
3. Send proposal (reuses the existing `SendProposal` submit + guardrails).

## Failure / edge states
- Browse a brand not accepting proposals → 403 (existing gate).
- Accept where template resolution / product binding fails → the proposal still accepts; no experience draft (best-effort). Logged, not surfaced as an error.
- All existing proposal limits (cooldown, rate limits, TTL, one counter) unchanged.
- Product ids from a different brand than the proposal's → ignored at seed time.

## Proof of success
- 8a: unit + local DB (browse → scoped proposal → accept → draft exists; accept without seed still works); `pnpm qa` green; existing proposal specs unchanged.
- 8b: jest for the browse/pick UI; Maestro batched.
