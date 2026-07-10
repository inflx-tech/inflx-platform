# Before / After — Creator Experiences (Phase 6)

## 6a (built, backend — web/API-verifiable) — this pass
**Before:** the placed Experience Template's `experience_template` rule returned
`[]` (Phase 5 stub) → section hidden.
**After:** the rule resolves published creator experiences into render items.

### End-to-end proof (local DB, no emulator)
Create template → place → create experience (4 products + featured) → publish → the rule resolves it:
- `rule BEFORE publish → 0 items` (section hidden — live home unchanged).
- `publish 2 products → REJECTED (product_ids)` — Theme min-products enforced.
- `publish 4 products → published`.
- `rule AFTER publish → 1 item`: title `"…'s Street Style"`, layout `hero_banner`,
  **featured = landscape** (correct for 16:9), visible slots obey the contract
  (avatar/offer dropped as null), 4 products, creator resolved.
- Fixed during verify: the resolver joined `influencers.name`/`handle`; real
  columns are `full_name` / `instagram_handle` (verify-twice).
- Full `pnpm qa` 95/95 green — existing follower/section specs unchanged (the
  engine edit only adds `ctx.templateId` + makes the previously-empty rule return data).

### What matches the intent
- New tables `creator_experiences` + `experience_products` (D1).
- Creator API: list-templates / stockable / create / publish / my-experiences.
- Engine: `experience_template` rule filled + `sectionEngine` passes `template_id` into ctx.
- Publish enforces the Theme's min-products + featured-required rules.

### v1 simplification (noted)
`featured_image_url` is a single image (upload or product image); the multi-image,
aspect-aware Asset Pack is Phase 7.

## 6b (built, off-device verified — Maestro batched) — this pass
**Follower render:** `SectionRenderer` gained an additive `entity_type==='experience'`
branch that draws each item via `AdaptiveRenderer` (P4b). Existing shelves unchanged.
**Creator Studio:** `ExperienceStudioScreen` (influencer) — pick template → select
products → featured image → publish; reached from influencer Home ("Create Experience");
`influencerApi` gained the 6a endpoints.

### Off-device proof (jest)
- `SectionRenderer.experience.test.js` 2/2: a placed-template shelf draws the
  experience (title + CTA via the renderer); a normal mixed shelf is unaffected.
- `ExperienceStudioScreen.test.js` 1/1: pick template → see products → publish
  calls create + publish with the right args → "Published".
- Full mobile jest **33/33 tests pass**. (1 rotating suite flag = pre-existing
  parallel act() warning — CartScreen/FollowerWalletScreen alternate, 0 assertion
  failures, none of my files.)
- Fixed during verify: jest.mock factory referenced non-`mock`-prefixed vars.

### On-device (Maestro) — batched
`qa/maestro/flows/07-creator-experience.yaml` (influencer: Home → Create Experience
→ AVAILABLE TEMPLATES) + `06-experience-preview.yaml` (4b). Run on the founder's
emulator in a batched real-device session. `release.released` flips true only after
Maestro green + OTA.

### Not yet OTA'd
Mobile pushed with `released=false` → the live follower/influencer apps are unchanged
until OTA. The home lights up after OTA + a creator publishes for a placed template.

## Live-home safety
Prod has 0 placed templates + 0 experiences → deploying 6a keeps the follower home
unchanged. The first visible change is a deliberate admin-place + creator-publish.
