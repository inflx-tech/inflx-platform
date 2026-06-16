# 05 — Impact: Phase 6 Presentation Types

**Verdict: additive + default-inert. New presentation paths only; existing row
placements unchanged. No migration, no new endpoint, no gating change.**

## Mechanics
- Backend `sectionEngine.service.js`: two new branches in `buildSections` keyed on
  `config_json.presentation_type` (`banner` → `banner_gateway` shelf; `hero_tiles`
  → `hero_tiles` shelf from the collection). Default/`row` path untouched. Rides
  the existing free-form `config_json` persistence (no migration, no whitelist).
- Admin `app/admin/sections/page.js`: presentation picker + banner/hero fields in
  the ⚙ editor; publish-guards. Navy theme. (UI-governed.)
- Mobile `components/SectionRenderer.js`: `banner_gateway` + `hero_tiles` renderers
  → existing `SectionResults` navigation (reuses 5b banner styling). (UI/Mobile-governed.)

## Blast radius
- Additive: a placement only changes when an admin explicitly sets a non-row
  presentation. All current placements default to `row` = today's behavior.
- Deploy-class: production-impacting (backend engine + Vercel + OTA) → migrate n/a;
  explicit founder go required before push; `released:false` until verify.
- Risk: low-moderate. Main care points: (1) banner gateway must NOT fall into the
  empty-section guard (it's a gateway, shows without pre-running the rule);
  (2) hero_tiles must not double-emit with the existing collection header/row
  expansion (branch is exclusive on presentation_type).
