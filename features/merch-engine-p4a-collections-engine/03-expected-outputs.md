# Expected outputs — Collections engine (Phase 4a)

## Automated
1. `node --check` green (collectionLibrary.service, sectionEngine, run-104) + engine loads.
2. `pnpm qa` → GREEN, gate 0, zero regression.
3. `pnpm qa:db` → migration 104 applies in-chain (no MIGRATION FAILED); validation test passes.
4. `collectionLibrary.validateCollection`: members must be an array of id strings; name required;
   bad input throws.

## Behavioural (dormant in 4a; proven in 4b once a collection is placed)
5. **Dormant**: with no collection placed, `/follower/*` outputs are byte-identical to pre-4a.
6. Engine expansion (covered once 4b places one): a collection placement →
   `collection_header` section (name+image) + member section shelves in order, each
   context-stacked (creator/brand/city); empty members hidden; all-empty collection →
   header suppressed (no empty band); unresolved collection_id → nothing.
7. Mobile renders `collection_header` (titled band) even with empty items.
8. Migration verified on prod: `to_regclass('public.collection_library')` non-null.

## Non-goals (NOT here)
- Admin builder + placement (4b). Dedicated collection page (Phase 6). Brand Store (Phase 5).
