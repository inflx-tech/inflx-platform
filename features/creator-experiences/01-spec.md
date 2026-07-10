# Feature Spec — Creator Experience Studio (Creator Experience Engine · Phase 6)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/01_DATA_MODEL.md §D` + decision D1. Builds on live Phases 1-5. **The payoff phase — the follower home lights up.** Mobile-governed (Maestro, batched per founder).

## Problem / goal
A creator turns a placed **Template** (P5) into a live **Experience**: pick a published template → select products → choose a featured image → **Publish**. Publishing creates a `creator_experiences` row that **fills the Phase-5 `experience_template` rule**, so the placed template finally resolves real content and renders on the follower home via the Adaptive Renderer (P4). "Rahul's Street Style" appears in the app.

## The 6a / 6b split (RECOMMENDED — confirm at build)
- **6a — data model + creator API + engine fill (web/API-verifiable NOW, no emulator):**
  - `creator_experiences` + `experience_products` tables (D1; reuse the lookbook pattern).
  - Creator API: list available templates (published, in creator's world; products gated to contracted brands, reusing the influencer-store stockable path); create + publish an experience.
  - **Fill the `experience_template` rule:** resolve published experiences bound to the row's `template_id`/template, build a render spec per experience (reusing 4a `renderSpec.service` with the experience's real pack), and pass `template_id` + config into the engine ctx.
  - Verify: unit + API + local DB — create an experience → the rule resolves it → the follower feed would include it. No emulator.
- **6b — Creator Studio mobile + follower render (mobile-governed, Maestro batched):**
  - Influencer app: Experience Studio (browse templates → pick → select products → featured image → publish).
  - Follower app: render `experience_template` sections via `AdaptiveRenderer` (P4b) on the home.
  - jest (off-device) now; Maestro on-device batched to a later real-device session (founder decision).

Recommendation: build **6a first** (lights up the data + engine path, fully verifiable), then **6b** (the two mobile surfaces).

## Scope
- **In scope:** the two new tables; creator experience API (list-templates / create / publish / my-experiences); the engine rule fill + ctx wiring; the influencer Studio screens; the follower render of experience sections; jest.
- **Out of scope:** the full **Asset Pack** imagery (Phase 7) — v1 uses a single `featured_image_url` (from an upload or a product image); scoped/theme-aware proposals (Phase 8); automatic/mixed *data* rules (Phase 9). Maestro on-device is deferred (batched).

## Surfaces touched
- Backend (new tables + creator API + the P5 rule fill — now returns data), influencer mobile (Studio), follower mobile (render), qa (unit + web + jest + a Maestro flow).
- Roles: influencer (Studio, `requireRole('influencer')`); follower (public render).

## Data / contracts
- **New tables** (per `01_DATA_MODEL.md §D`): `creator_experiences` (influencer_id, template_key, theme_key, brand_id?, `featured_image_url` [v1; Asset Pack = P7], status draft/published/archived, source_proposal_id?) + `experience_products` (experience_id, product_id, variant_id, display_order).
- **Engine:** `experience_template` rule (P5 stub) now → SELECT published experiences for the template → per experience build a render spec (theme tokens + layout contract + pack{creator, featured_image_url, products, offer}). `sectionEngine` passes `template_id` + `config_json` into ctx.
- **New endpoints:**
  - `GET /v1/influencers/me/experience-templates?world_key=` — published templates the creator can use.
  - `GET /v1/influencers/me/experience-stockable?template_id=` — products the creator may add (contracted brands).
  - `POST /v1/influencers/me/experiences` — create (template + product_ids + featured_image_url).
  - `POST /v1/influencers/me/experiences/:id/publish` — validate (theme min/max products, featured required) → published.
  - `GET /v1/influencers/me/experiences` — my experiences.
  - (follower) the existing `GET /v1/follower/section/category/:key` now returns experience sections with items.

## Non-functional
- Publish validation enforces the **Theme's** rules (min/max products, featured required) — the enforcement point promised since Phase 2.
- **Live-home safety:** until a creator publishes an experience for a *placed* template, the section stays empty (hidden) — unchanged from Phase 5. The first published experience is the first visible change.
- Mobile-governed: `release.released=true` needs `maestro_green=true` — deferred; push mobile with `released=false` (no OTA) per the established pattern.

## Functional outcome
Creator opens Studio → **Available Templates** → picks **Street Style** → selects products → picks a featured image → **Publish**. On the follower app, the placed Street Style section on the Fashion home now shows **"Rahul's Street Style"**, drawn by the Adaptive Renderer. The platform is end-to-end.
