# Feature Spec — Scoped, theme-aware proposals (Creator Experience Engine · Phase 8)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/01_DATA_MODEL.md §F`. Extends the live Phase-Q proposals (`influencer_proposals`, migration 025). Builds on P1-7.

## Problem / goal
Today a creator's proposal is campaign-level only. Your vision: the creator **browses a brand's store + products**, then proposes at **store / category / product** scope, tied to a **Theme** ("I'll do a Street Style experience with products a,b,c,d"). On brand acceptance, an **experience draft is seeded** (bound to the theme + the proposed products) so the creator finishes it in the Studio (Phase 6). This joins the two inbound paths — proposals now feed the experience engine.

## The 8a / 8b split (RECOMMENDED — confirm at build)
- **8a — proposal model + store-browse API + acceptance seed (web/API-verifiable NOW):**
  - EXTEND `influencer_proposals` (scope_level, scope_ref_json, theme_key, proposed_product_ids) — all nullable, additive.
  - Creator **store-browse** API: browse a brand's products (only brands with `accepts_proposals`, reusing the existing discover-brands gate).
  - Scoped proposal create (the existing create endpoint accepts the new fields).
  - On **accept**, in addition to today's mini-campaign, **seed a `creator_experiences` draft** (theme_key + proposed products + `source_proposal_id`), binding a matching placed template if one exists (else the draft awaits a template in the Studio → `creator_experiences.template_key` loosened to nullable for drafts).
  - Verify: unit + local DB — browse → scoped proposal → accept → experience draft exists.
- **8b — mobile store-browse + product picker (mobile-governed, Maestro batched):**
  - Influencer app: in `SendProposal`, browse the brand's products, pick scope + products + theme.
  - jest now; Maestro batched.

Recommendation: build **8a first**.

## Scope
- **In scope:** the proposal-table extension; the store-browse API; scoped-proposal create; acceptance→experience-draft seeding; the mobile browse/pick UI (8b).
- **Out of scope:** changes to the existing proposal state machine (accept/reject/counter/cooldown/rate-limits all preserved); brand-side proposal inbox rework (it already exists — it just shows the new scope/theme fields).

## Surfaces touched
- Backend (proposals extension + browse API + acceptance seed), influencer mobile (browse + pick), qa.
- Roles: influencer (browse + propose), brand (accept — existing).

## Data / contracts
- **Extend `influencer_proposals`** (migration ≥138, all nullable):
  `scope_level text` ('store'|'category'|'product'), `scope_ref_json jsonb` ({category_node_id} | {product_ids:[…]}), `theme_key text`, `proposed_product_ids jsonb`.
- **Loosen** `creator_experiences.template_key` → nullable (proposal-seeded drafts may not have a template yet).
- **New endpoints (influencer):**
  - `GET /v1/influencers/me/discover-brands/:id/products?q=` — the brand's browsable products (gated: brand accepts proposals).
  - existing `POST /v1/influencers/me/proposals` — now accepts the new fields.
- **Acceptance** (existing brand accept path) — extended to seed the experience draft (best-effort; never breaks the existing accept).

## Non-functional
- All existing proposal guardrails preserved (cooldown, 5 active, 3/day, 10/week, TTL, one counter round).
- Acceptance seed is **best-effort**: if template resolution or product binding fails, the proposal still accepts (campaign created as today) — the seed never blocks acceptance.
- Store-browse gated to brands that opted into proposals; products limited/paginated.
- Mobile-governed: mobile `released=false` (batched) per pattern.

## Functional outcome
Rahul opens Discover → a brand → **browses its products** → picks 4 + a scope (products) + theme **Street Style** → sends the proposal. The brand accepts. In Rahul's Studio, a **Street Style experience draft** is already waiting with those products — he adds a featured image and publishes.
