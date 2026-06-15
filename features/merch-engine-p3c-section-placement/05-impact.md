# Impact — Section placement (Phase 3c)

**Terse verdict:** Extension of the App Sections admin page to place a library section, plus
a 2-line engine safety guard. No mobile, no migration (renderer + saveSections already
support it). The first follower-visible output of Phase 3. Low risk.

## Blast radius
- `app/admin/sections/page.js` (+ fetches the library list) → Vercel.
- `sectionEngine.service.js` 2-line guard (unresolved library placement → empty) → Render.
- A placement creates a normal `section_config` row (`rule='library_products'`) the engine
  already knows how to render. Existing shelves untouched.

## What could break + mitigation
- *Placement without a section selected* → save blocked with a hint.
- *Underlying section hidden/deleted later* → engine `getRuleJson` → null → empty shelf →
  hidden (existing behavior). No crash.
- *Cache* → new placement appears within the section-cache TTL (~60s) / on admin cache-bust.

## Reversibility
- Remove the placed shelf in App Sections (existing delete), or revert the page file.

## Deploy classification
**Production-impacting** (brand-web admin → it changes what followers see once a section is
placed) → explicit founder go. UI-governed → mockup-lock + 06-diff. No backend/OTA. released
=false until founder verifies the follower render.
