# Impact — Experience Templates + placement (Phase 5)

**Verdict (one line): additive — one new table + one nullable column + one NEW (isolated) section-engine rule + admin CRUD/place + two admin screens. The live follower home is UNCHANGED in Phase 5 (a placed template resolves empty → hidden until creators fill it in Phase 6).**

## Mechanics
- **DB:** new `experience_templates` (mig ≥133) + `section_config.template_id` nullable column (≥134). `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, idempotent. No existing row/column changed.
- **Backend:** new `template.service.js` + `adminTemplates.controller.js` + routes. **One touch to the live engine:** a new rule key `experience_template` in `sectionRules.service` that returns `[]` in Phase 5 (no experiences). This is *additive* — no existing rule function is modified; every current shelf resolves identically. `place` upserts a `section_config` row using the existing admin-sections write path.
- **Web (brand-web):** new pages `app/admin/experience-templates/` (list + builder). New nav entry. No change to existing admin pages. **UI-governed** → mockup-lock + diff gates.
- **Mobile / follower runtime:** no code change. A placed template is invisible until Phase 6.
- **Money/attribution/status machines:** none.

## Risk
- **Higher than P1-4 because it touches the live section engine** — but bounded: the only engine change is a *new* rule that returns empty. The proof obligation: the follower home payload is byte-for-byte unchanged after this ships (existing shelves untouched; the new rule only fires for rows with `rule='experience_template'`, of which there are none until an admin places one, and even then it yields empty → hidden).
- Placing a template writes a real `section_config` row → it must be `enabled` yet render empty (honest hidden), and `unplace` must cleanly remove it. Verified in QA.
- Worst case: a placed template shows an empty (dropped) section — never a broken or wrong section.

## Dependencies
- Live Phases 1-3 (presets/themes/layouts) + section engine. Consumed by Phase 6 (experiences fill the rule) + the renderer (P4).

## Release classification
- Contract + docs + mockups: **deploy-inert**.
- Migration + backend + brand-web: **production-impacting** → explicit go. Extra care: confirm zero change to the live follower home before deploy.
