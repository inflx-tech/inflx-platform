# Expected outputs — Section placement (Phase 3c)

## Automated
1. `npm run build` (brand-web) → exit 0.
2. `pnpm qa` → GREEN, gate 0, zero regression.

## Behavioural (after deploy)
3. **Place**: App Sections → Home → add **Library Section** → dropdown lists the sections
   authored in 3b → pick "Jeans Under ₹499" → title auto-fills → Publish succeeds.
4. **Render (platform)**: follower Home shows a "Jeans Under ₹499" shelf with gated products
   (approved brand + pushed-to-store) within ~60s (section cache TTL).
5. **Render (creator context)**: place the same section on Creator Store → in a creator's
   store it shows only that creator's live-allocated jeans (context stacking proven).
6. **Empty → hidden**: a placement whose rule matches nothing renders no shelf (engine hides empty).
7. **Resilience**: hide the underlying library section → the placed shelf renders empty (no crash).

## Non-goals (NOT expected here)
- Templates/slots, Collections (Phase 4). Banner-gateway/hero-tiles (Phase 6).
- Backend/mobile/migration changes (none — reuses existing engine + renderer).
