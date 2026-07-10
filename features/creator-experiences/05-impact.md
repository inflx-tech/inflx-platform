# Impact — Creator Experience Studio (Phase 6)

**Verdict (one line): the first FOLLOWER-VISIBLE change of the program — but only after a creator publishes. Additive: two new tables, a creator API, the Phase-5 rule now returns data, plus the two mobile surfaces. Until the first publish for a *placed* template, the live home is unchanged.**

## Mechanics
- **DB:** new `creator_experiences` + `experience_products` (migration ≥135). `creator_lookbooks`/`lookbook_products` stay untouched (a separate lightweight surface). Additive/idempotent.
- **Backend:** new `experience.service.js` + `influencerExperiences.controller.js` + routes; the `experience_template` rule (P5 stub) now resolves published experiences → render specs (reusing `renderSpec.service`); `sectionEngine` passes `template_id`/config into ctx. **The only change to an existing engine function is that the previously-empty rule now returns data** — every other rule/section is unchanged.
- **Mobile (6b):** new influencer Studio screens; the follower `SectionRenderer` gains an `experience`/`experience_template` branch that draws items via `AdaptiveRenderer`. Existing screens untouched. **Mobile-governed** (Maestro batched).
- **Money/attribution:** experiences drive the same product/checkout + creator attribution paths (reuse); no new money logic.

## Risk
- **Highest follower-facing risk so far** — it makes a real section appear. Bounded by: (1) it only appears once a creator publishes for a *placed* template (admin-gated placement + creator publish, both deliberate); (2) publish is server-validated against the Theme's rules; (3) the follower render reuses the P4 renderer already off-device-proven.
- Worst case: an experience section renders imperfectly for one creator — not a platform-wide regression (each experience is an independent item; the engine's hide-empty + per-item render isolate failures).
- The `experience_template` rule must stay defensive (bad/blocked spec → skip the item, never 500 the feed).

## Dependencies
- Live Phases 1-5. Consumes P4 renderer (6b). Asset Pack (P7) later upgrades `featured_image_url` → multi-image pack.

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- 6a (backend): **production-impacting** → explicit go. Extra care: the live home must stay unchanged until the first deliberate publish; verify no placed templates have accidental experiences at deploy.
- 6b (mobile): **production-impacting** (OTA) + **Maestro-gated** → push with `released=false` (no OTA) now; OTA + released after the batched on-device pass + go.
