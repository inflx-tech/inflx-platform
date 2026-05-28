# Flow 45 — Workflow

## Governance loop (locked 5-step rhythm)
1. **Audit** — read all 9 restaurant atoms + both StatusPills; confirm prop APIs,
   compositions, token usage. ✅ done (verify-twice).
2. **Mockup** — `design/wave3/flow-45-restaurant-atom-cascade/web.html` (9-atom
   gallery + in-context feed). ✅
3. **Scoping + green signal** — AskUserQuestion: atom-cascade-first + re-theme
   restaurant StatusPill (both chosen) → "go and implement". ✅ (mockup_locked)
4. **Implement** — converge each atom's StyleSheet/inline tokens lightColors→
   brandPalette (visual only). Update index.js comment.
5. **After-evidence** — emulator screenshots SKIPPED (atoms aren't a standalone
   screen; visible once dining screens ship). After-evidence = founder physical
   APK smoke-test on live follower v58 + the gallery mockup.
6. **06-diff/notes.md** — plain-English before/after notes.
7. **Web QA** — dual-probe pre-warm → `pnpm qa` → 76/76 GREEN gate 0.
8. **Deploy** — `pnpm publish-ota:all` (brand v95 / influencer v84 / follower v58).
9. **Close-out** — fetch manifest hashes → backfill lock.json release block →
   close-out commit (`GOVERNANCE_OVERRIDE` on push).

## Token map (lightColors → brandPalette)
paper→white · surface→bg2 · border→border · border2→muted4 · ink/ink2→same ·
muted/muted2/muted3→same · white→white · success(#00B894)→success(#10B981) ·
success50→successPale · danger→danger · danger50→dangerPale · warning→yellow ·
warning50→yellowPale · yellow(#EAB308)→yellow(#FFC107) · yellow50→yellow50 ·
yellow200→yellowPale · yellowDeep→yellowText (links) · ink hero/chips unchanged.

restaurant/StatusPill PALETTE rewrite:
- open      → bg successPale, fg successText, dot success, border #6EE7B7
- closed    → bg bg2,         fg muted2,      dot muted2,  border border
- pending   → bg yellowPale,  fg yellowText,  dot yellow,  border yellow
- confirmed → bg successPale,  fg successText, dot success, border #6EE7B7
- cancelled → bg dangerPale,  fg dangerText,  dot danger,  border danger
- live      → bg yellowPale,  fg ink,         dot yellow,  border yellowPale

## Verification
Per-file grep: 0 `lightColors.*` refs remaining (import swapped to brandPalette);
prop signatures unchanged. Babel transform PASS for all 9. Existing jest tests that
render restaurant components (RestaurantBill/Cart/Booking tests) stay green.
