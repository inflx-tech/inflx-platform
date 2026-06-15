# Workflow — Collections engine (Phase 4a)

## Build order
1. **Migration `104_collection_library.sql`** (+ `scripts/run-104.js`) — `collection_library`.
2. **`collectionLibrary.service.js`** — CRUD + validation + `getForRender(id)` →
   `{ name, image_url, sections: [{id,name}] }` (active members, in stored order).
3. **Engine** (`sectionEngine.buildSections`): PRE-EXPAND a `rule='collection'` row into a
   synthetic `collection_header` row + one synthetic `library_products` row per member
   (`config_json.library_section_id`), tagged with a group id. The existing loop renders each
   (members reuse the Phase-3 evaluator + context stacking). Post-pass: drop a header whose
   group has zero non-empty member shelves (no empty titled band).
4. **Mobile** `SectionRenderer`: add `case 'collection_header'` (titled band + optional image),
   rendered before the empty-items guard.
5. Pure unit test for `collectionLibrary.validateCollection` (members array of ids, etc.).

## Verify
- `node --check` (service, engine, run-104) + engine require smoke.
- `pnpm qa` → GREEN gate 0. `pnpm qa:db` → migration 104 applies in-chain.
- Mobile JS bundles (OTA build).

## Deploy (production-impacting — explicit founder go)
- Migrate prod first (run-104), push backend (Render), OTA the follower bundle. Dormant
  until 4b builds + places a collection. released=false.

## Expected end state
- A placed collection renders as a titled header + its member section shelves, context-aware;
  empty collections render nothing. Ready for 4b (admin builder + placement).
