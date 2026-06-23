# 02 — Workflow · Follower Step 0

1. Audit (done) → Docs/FOLLOWER_APP_MAP.md identifies dead screens + cheap bugs.
2. Verify-twice: grep all references for each deletion target + the OrderCart
   callers before removing.
3. Delete dead files; remove their FollowerNavigator imports + Stack.Screen rows.
4. Repoint OrderCart callers; fix veg display (shared vegKind helper, 5 sites);
   fix login leaks.
5. Verify: metro bundle compiles (full graph) + `npx jest` green.
6. Ship: commit (paths only) → push (gov-check) → publish-ota:all.

Expected end state: app builds, no dead routes, unmarked dishes no longer show
a false non-veg mark, login no longer leaks the test OTP / hardcoded city.
