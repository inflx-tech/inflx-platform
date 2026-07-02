# Impact — admin-frame-builder-ux

**Verdict:** admin-UX clarity pass + one small mobile routing addition. Additive to
`config_json`; no backend, no migration. Existing sections keep working.

## Surface
- **Admin brand-web `app/**` (Vercel):** `sections/page.js` — blank section title +
  placeholder + publish name-gate; removed `TemplatePreview`; labeled tile rule form
  (loads `listTagVocabulary` for the world); per-tile `On tap →` dropdown;
  section-level chooser hidden for `tiles`.
- **Mobile `src/**` (OTA, no APK):** `SectionRenderer.js` tile `onTile` honors
  `tile.tap_destination` (→ CategoryBrowser / FollowerPage) before the default grid.
- **Backend:** none — all fields ride `config_json`; `libraryProducts` already honors
  the rule keys.

## Risk register
- **Regression:** low. Rule keys unchanged (form writes the same `rule_json` fields the
  engine already reads); default tile tap = today's grid route. Gates: `pnpm qa` GREEN
  79 + jest 25/25 (incl. TileSection).
- **Naming gate:** blocks publish on blank titles — intended; existing saved sections
  already have titles, so no existing scope is blocked.
- **Tag vocab load:** optional-chained + catch → empty tags if unavailable (page scope
  has none); no crash.
- **`undefined` rule values:** cleared fields write `undefined` → dropped by
  `JSON.stringify` on save → key absent (engine treats absent as no-filter). Correct.

## Deploy classification
Production-impacting (Vercel admin + mobile OTA). No backend/migration. Ships together
→ founder walk. `release.released` false.
