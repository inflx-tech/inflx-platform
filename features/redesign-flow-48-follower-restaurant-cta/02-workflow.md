# Flow 48 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read RestaurantCart/Booking/Bill/MealsChat; confirm tokens, atoms,
   APIs, mockPayment, 4-ID, auth gates, render branches. ✅ (verify-twice)
2. **Mockup** — `design/wave3/flow-48-follower-restaurant-cta/web.html`, 4 frames. ✅
3. **Green signal** — AskUserQuestion → "Green — implement". ✅ (mockup_locked)
4. **Implement** — alias import + token renames per screen (surface2 before surface). ✅
5. **After-evidence** — emulator screenshots SKIPPED (deep, payment/data-gated screens);
   after-evidence = mockup + founder physical APK smoke-test on live follower v61.
6. **06-diff/notes.md** — before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v98 / influencer v87 / follower v61).
9. **Close-out** — fetch hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push).

## Verification (done)
- 0 orphaned `lightColors.{paper|surface|surface2|border2|yellowDeep|yellow200|
  success50}` refs across the 4 screens.
- Babel transform PASS (4/4).
- jest: RestaurantBooking / RestaurantCart / RestaurantBill suites PASS 9/9 (exercise
  these exact screens + the BookingConfirmed nav param shape).
