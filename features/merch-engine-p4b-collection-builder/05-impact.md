# Impact — Collection builder + placement (Phase 4b)

**Terse verdict:** Net-new admin screen (Collection Library) + admin CRUD + a "Collection"
placement preset in App Sections. No migration, no mobile, no engine change (4a renders).
Reuses the Section-Library list for the section picker. Activates Phase 4 end-to-end.

## Blast radius
- New admin page + nav (brand-web) → Vercel. New admin controller/routes + api.js → Render.
- App Sections page gains a preset + collection picker (like 3c's library picker). Existing
  shelves/placements untouched.

## What could break + mitigation
- *Placement without a collection* → publish blocked + engine renders nothing (4a safety).
- *Empty/all-hidden collection* → 4a suppresses the band. No empty header.
- *Ordering* → section_ids stored as an ordered array; getForRender preserves order.
- *Auth* → requireAnyAdminRole on all endpoints.

## Reversibility
- Additive; revert files. Collections built are inert until placed; placements removable in App Sections.

## Deploy classification
**Production-impacting** (brand-web admin + backend routes → changes what followers see once a
collection is placed) → explicit founder go. UI-governed → mockup-lock + 06-diff. No mobile/OTA.
released=false until founder verifies.
