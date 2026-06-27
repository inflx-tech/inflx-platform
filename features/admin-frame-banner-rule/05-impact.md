# 05 — Impact

**Verdict:** additive — one new rule condition, one new tap param, a per-tile rule form.
No migration; existing flows unchanged.

## Functional disturbance
- **None to existing sections.** The brand clause only fires when `rule_json.brand` is
  set; `getSectionResults` only reads inline `rule_json` when no `library_section_id`.
  Tiles without an inline rule behave exactly as before (wired group).
- No schema change — rules ride `config_json` / query param.

## Surfaces touched
- backend: `sectionRules.service.js` (+brand condition), `follower.controller.js`
  (+inline rule_json on the tap endpoint).
- admin: `brand-web/app/admin/sections/page.js` (+`patchTileRule`, +per-tile rule form).
- mobile: `SectionRenderer.js` (tiles tap passes rule_json), `SectionResultsScreen.js`
  + `api.js` (thread rule_json).

## Deploy classification
**Production-impacting** (backend/src + brand-web + mobile runtime). Backend → Render,
admin → Vercel, mobile → OTA. **No migration.** Surfaced for explicit go.

## Risk
- Low. All additive + guarded. Brand match case-insensitive to reduce typos.
- `release.released` stays false (no Maestro, per program precedent).
