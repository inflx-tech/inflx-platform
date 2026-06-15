# Impact — Collections engine (Phase 4a)

**Terse verdict:** New `collection_library` table + engine expansion (a collection placement
→ titled header + member section shelves) + one mobile renderer case. Members reuse the
Phase-3 evaluator + context stacking — no new ranking. DORMANT until a collection is built +
placed (4b). Backend + small mobile.

## Blast radius
- Migration 104 (new table) · `collectionLibrary.service.js` · `sectionEngine` pre-expand +
  empty-header post-pass · mobile `SectionRenderer` one case. Existing shelves untouched.
- Render (backend) + OTA (mobile). No brand-web in 4a.

## What could break + mitigation
- *Existing feeds*: expansion only triggers on `rule='collection'` rows (none exist until 4b)
  → byte-identical until then (test #5).
- *Empty collection / empty members*: header suppressed when no member shelf has items; empty
  members hidden individually — no empty bands.
- *Unresolved collection_id*: emits nothing (safety, like 3c).
- *Mobile header with empty items*: rendered intentionally (the band); guarded to that one type.

## Reversibility
- Additive; revert files + (optionally) drop the empty table. No data lost.

## Deploy classification
**Production-impacting** (backend + migration + mobile OTA) → explicit founder go; migrate-first.
UI-governed (mobile) → mockup-lock + 06-diff. released=false; no Maestro (not flipping released).
