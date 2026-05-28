# Flow 47 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read RestaurantDetailScreen (1,106 LOC); confirm tokens, composed
   atoms, dispatchAction, cart, tabs, reviews/meals APIs, render branches. ✅
2. **Mockup** — `design/wave3/flow-47-follower-restaurant-detail/web.html`, 3 frames. ✅
3. **Green signal** — AskUserQuestion → "Green — implement". ✅ (mockup_locked)
4. **Implement** — alias import + token renames across the 3 StyleSheets + inline. ✅
5. **After-evidence** — emulator screenshots SKIPPED (deep, data-gated detail screen);
   after-evidence = mockup + founder physical APK smoke-test on live follower v60.
6. **06-diff/notes.md** — before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v97 / influencer v86 / follower v60).
9. **Close-out** — fetch hashes → backfill lock.json → close-out commit
   (`GOVERNANCE_OVERRIDE` on push).

## Verification (done)
- 0 orphaned `lightColors.{paper|surface|surface2|border2|yellowDeep|yellow200|
  success50|warning}` refs.
- Babel transform PASS.
- jest: RestaurantBooking/Cart/Bill suites PASS 9/9 (exercise the screen's nav +
  composed atoms).
- Marker grep: dispatchAction / buildTracking / navigation.navigate / goToCart /
  mealsApi.getStore / getBrandReviews / postReview present (18 occ) — logic untouched.
