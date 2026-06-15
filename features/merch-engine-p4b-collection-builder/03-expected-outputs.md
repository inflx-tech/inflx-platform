# Expected outputs — Collection builder + placement (Phase 4b)

## Automated
1. `npm run build` (brand-web) → exit 0.
2. `pnpm qa` → GREEN, gate 0, zero regression.
3. Admin endpoints (gated) return documented shapes; non-admin rejected.

## Behavioural (admin, after deploy)
4. **Build**: Admin → Collection Library → New → name "Summer Collection" → add 2+ sections
   from the Section-Library dropdown → reorder with ↑/↓ → Save → row shows with member count.
5. **Edit/hide**: edit reorders/members; hide leaves the active set.
6. **Place**: App Sections → Home → + Add: Collection → pick "Summer Collection" → title
   auto-fills → Publish (blocked if no collection picked).
7. **Render** (follower, ~60s): Home shows a "Summer Collection" titled band + its member
   section shelves in order; empty members hidden; all-empty collection → no band.
8. **Context**: same collection placed on Creator Store → in a creator's store shows only that
   creator's matching items per member section.

## Non-goals (NOT here)
- Engine/mobile/migration changes (4a). Dedicated collection page (Phase 6).
