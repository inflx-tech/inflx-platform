# Impact — Scoped, theme-aware proposals (Phase 8)

**Verdict (one line): additive — four nullable columns on `influencer_proposals`, one loosened constraint, a creator store-browse endpoint, and a best-effort experience-draft seed on accept. The existing proposal flow is unchanged; a plain (unscoped) proposal behaves exactly as today.**

## Mechanics
- **DB:** `ALTER TABLE influencer_proposals ADD COLUMN … (4 nullable)` + `ALTER TABLE creator_experiences ALTER COLUMN template_key DROP NOT NULL` (migration ≥138). Additive/loosening; every existing proposal row keeps NULLs.
- **Backend:** extend the proposal-create validator to accept the new (optional) fields; a new creator store-browse controller/route (reuses the discover-brands gate); the brand-accept path calls a new **best-effort** `seedExperienceFromProposal()` — wrapped so a failure never blocks the accept.
- **Mobile (8b):** `SendProposal` gains a browse-products + scope + theme step. Existing proposal screens otherwise unchanged. Mobile-governed.
- **Money/attribution:** none — acceptance still creates the same mini-campaign; the experience draft is separate + unpublished.

## Risk
- Low-medium. The one sensitive spot is the **accept path** (a live, money-adjacent flow). Mitigation: the seed is strictly best-effort and wrapped in its own try/catch — if anything about seeding fails, the accept completes exactly as today (campaign created, proposal accepted). Proven by a test that forces a seed failure and asserts the accept still succeeds.
- Loosening `template_key` to nullable is safe: published experiences still get a template (Studio publish requires it); only proposal-seeded *drafts* may be null until completed.
- Worst case: an accepted scoped proposal doesn't seed a draft → the creator creates the experience manually (today's behavior). No breakage.

## Dependencies
- Live Phase-Q proposals (mig 025) + Phase 5 templates + Phase 6 experiences.

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- 8a (backend): **production-impacting** → explicit go; unscoped proposals unchanged.
- 8b (mobile): **production-impacting** (OTA) + gated → `released=false` (batched).
