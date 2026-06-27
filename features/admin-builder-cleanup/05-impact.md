# 05 — Impact

**Verdict:** admin-only redesign + one additive backend tweak (the "All" tile). No
migration, no mobile/OTA.

## Functional disturbance
- **App config unchanged in shape.** Frames still store `config_json.tiles[]`; the
  create/saved toggle is just UI over the existing `rule_json` / `library_section_id`
  fields. Existing saved sections render the same.
- **Menu consolidation** removes presets from the *picker* only — existing saved sections
  of those shelf_types still load + render (the editor keys off shelf_type, unchanged).
- **Section Library nav link removed** — the page still resolves (unlinked, like Home Builder).
- **Backend:** `categoryNodes` appends an "All" tile (additive; tap → existing nav 'all'→Find).

## Surfaces touched
- backend: `sectionRules.service.js` (`categoryNodes` All tile).
- admin: `brand-web/app/admin/sections/page.js` (kinds/tags · grouped menu · frame
  rule create-or-saved + save-for-reuse · MobilePreview + 2-col layout),
  `brand-web/app/admin/layout.js` (remove Section Library nav).

## Deploy classification
**Production-impacting** (backend/src + brand-web). Backend → Render, admin → Vercel.
**No migration, no OTA.** Surfaced for explicit go.

## Risk
- Low–moderate (large admin file edit) — mitigated by `npm run build` exit 0 + `pnpm qa` green.
- The "All" tile routes to the existing 'all' handler (Find) for now — a richer
  "all categories of this world" landing is a fast-follow.
- `release.released` stays false (no Maestro; admin-only anyway).
