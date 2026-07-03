# Impact Analysis — Rule builder depth (P4)

> One-line verdict: **backend rule-vocabulary extension + two admin forms —
> no mobile, no migration, no payload change; existing rules byte-identical.**

## Affected files
- backend: `sectionLibrary.service.js` (validateRule +3 keys),
  `sectionRules.service.js` (libraryProducts: exclude_tags + product_ids
  clauses + order), `adminSectionLibrary.controller.js` + `admin.routes.js`
  (product-search endpoint).
- web: `admin/sections/page.js` (wizard My-rule builder +3 controls),
  `admin/section-library/page.js` (same +3, prevents silent-strip on edit).
- mobile: none.

## Risk notes
- validateRule is additive — old rules validate identically; preview endpoint
  exercises new keys pre-save.
- product_ids capped at 50; order enforced via array_position leading ORDER BY
  only when hand-picked (otherwise unchanged sort logic).
- product-search reuses the existing gates (approved brand + pushed_to_store +
  business_type members) — no new exposure; `libraries` capability required.
- Rollback: revert commit; saved rules with new keys degrade to ignored keys
  under the old validator (read path never re-validates).

## Release classification
**production-impacting** (Render + Vercel). No OTA, no Maestro. Founder
pre-authorized P4+P5 completion incl. deploys ('pls proceed and complete
remaining two phases') — push surfaced loudly in the session log.
